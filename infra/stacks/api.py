import aws_cdk as cdk
from aws_cdk import (
    aws_apigatewayv2 as apigw,
    aws_apigatewayv2_authorizers as authorizers,
    aws_apigatewayv2_integrations as integrations,
    aws_lambda as lambda_,
    aws_iam as iam,
)
from constructs import Construct


class ApiStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, env_name: str, auth_stack, data_stack, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name
        self.auth_stack = auth_stack
        self.data_stack = data_stack

        # Lambda code for every function in this stack lives under services/, with
        # api/, shared/ and websocket/ as sibling top-level packages of the zip.
        services_code = lambda_.Code.from_asset("../services")

        # ---------------------------------------------------------------
        # WebSocket API — connect/disconnect + the endpoint REST handlers
        # broadcast job updates to.
        # ---------------------------------------------------------------

        ws_role = iam.Role(
            self,
            "WebSocketLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )
        ws_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "service-role/AWSLambdaBasicExecutionRole"
            )
        )
        self.data_stack.main_table.grant_read_write_data(ws_role)
        ws_role.add_to_policy(
            iam.PolicyStatement(
                actions=["cognito-idp:GetUser"],
                resources=[self.auth_stack.user_pool.user_pool_arn],
            )
        )

        authorizer_fn = lambda_.Function(
            self,
            "WebSocketAuthorizerFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="websocket.authorizer.lambda_handler",
            code=services_code,
            role=ws_role,
            timeout=cdk.Duration.seconds(10),
            memory_size=256,
        )

        connect_fn = lambda_.Function(
            self,
            "ConnectFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="websocket.connect.lambda_handler",
            code=services_code,
            role=ws_role,
            environment={"TABLE_NAME": self.data_stack.main_table.table_name},
            timeout=cdk.Duration.seconds(10),
            memory_size=256,
        )

        disconnect_fn = lambda_.Function(
            self,
            "DisconnectFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="websocket.disconnect.lambda_handler",
            code=services_code,
            role=ws_role,
            environment={"TABLE_NAME": self.data_stack.main_table.table_name},
            timeout=cdk.Duration.seconds(10),
            memory_size=256,
        )

        self.websocket_api = apigw.WebSocketApi(
            self,
            "WebSocketApi",
            api_name=f"jobhunter-ws-{env_name}",
            connect_route_options=apigw.WebSocketRouteOptions(
                integration=integrations.WebSocketLambdaIntegration(
                    "ConnectIntegration", connect_fn
                ),
                authorizer=authorizers.WebSocketLambdaAuthorizer(
                    "ConnectAuthorizer",
                    authorizer_fn,
                    identity_source=["route.request.querystring.token"],
                ),
            ),
            disconnect_route_options=apigw.WebSocketRouteOptions(
                integration=integrations.WebSocketLambdaIntegration(
                    "DisconnectIntegration", disconnect_fn
                ),
            ),
        )

        self.websocket_stage = apigw.WebSocketStage(
            self,
            "WebSocketStage",
            web_socket_api=self.websocket_api,
            stage_name=env_name,
            auto_deploy=True,
        )

        ws_management_arn = self.format_arn(
            service="execute-api",
            resource=self.websocket_api.api_id,
            resource_name=f"{self.websocket_stage.stage_name}/POST/@connections/*",
            arn_format=cdk.ArnFormat.SLASH_RESOURCE_NAME,
        )
        ws_endpoint = (
            f"https://{self.websocket_api.api_id}.execute-api.{self.region}.amazonaws.com/"
            f"{self.websocket_stage.stage_name}"
        )

        # ---------------------------------------------------------------
        # HTTP API — job CRUD, authenticated via a Cognito JWT authorizer.
        # ---------------------------------------------------------------

        jwt_authorizer = authorizers.HttpJwtAuthorizer(
            "JwtAuthorizer",
            jwt_issuer=f"https://cognito-idp.{self.region}.amazonaws.com/{self.auth_stack.user_pool.user_pool_id}",
            jwt_audience=[self.auth_stack.user_pool_client.user_pool_client_id],
        )

        self.http_api = apigw.HttpApi(
            self,
            "HttpApi",
            api_name=f"jobhunter-api-{env_name}",
            cors_preflight=apigw.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[
                    apigw.CorsHttpMethod.GET,
                    apigw.CorsHttpMethod.POST,
                    apigw.CorsHttpMethod.PUT,
                    apigw.CorsHttpMethod.DELETE,
                    apigw.CorsHttpMethod.OPTIONS,
                ],
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        lambda_role = iam.Role(
            self,
            "LambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )
        lambda_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "service-role/AWSLambdaBasicExecutionRole"
            )
        )
        self.data_stack.main_table.grant_read_write_data(lambda_role)
        lambda_role.add_to_policy(
            iam.PolicyStatement(
                actions=["execute-api:ManageConnections"],
                resources=[ws_management_arn],
            )
        )
        self.data_stack.bucket.grant_read_write(lambda_role)

        job_fn_env = {
            "TABLE_NAME": self.data_stack.main_table.table_name,
            "WS_ENDPOINT": ws_endpoint,
        }

        profile_fn_env = {
            "TABLE_NAME": self.data_stack.main_table.table_name,
            "BUCKET_NAME": self.data_stack.bucket.bucket_name,
        }

        create_job_fn = lambda_.Function(
            self,
            "CreateJobFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.handlers.create_job_handler",
            code=services_code,
            role=lambda_role,
            environment=job_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        get_jobs_fn = lambda_.Function(
            self,
            "GetJobsFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.handlers.get_jobs_handler",
            code=services_code,
            role=lambda_role,
            environment=job_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        update_job_fn = lambda_.Function(
            self,
            "UpdateJobFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.handlers.update_job_handler",
            code=services_code,
            role=lambda_role,
            environment=job_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        delete_job_fn = lambda_.Function(
            self,
            "DeleteJobFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.handlers.delete_job_handler",
            code=services_code,
            role=lambda_role,
            environment=job_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        self.http_api.add_routes(
            path="/jobs",
            methods=[apigw.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration("CreateJobIntegration", create_job_fn),
            authorizer=jwt_authorizer,
        )

        self.http_api.add_routes(
            path="/jobs",
            methods=[apigw.HttpMethod.GET],
            integration=integrations.HttpLambdaIntegration("GetJobsIntegration", get_jobs_fn),
            authorizer=jwt_authorizer,
        )

        self.http_api.add_routes(
            path="/jobs/{id}",
            methods=[apigw.HttpMethod.PUT],
            integration=integrations.HttpLambdaIntegration("UpdateJobIntegration", update_job_fn),
            authorizer=jwt_authorizer,
        )

        self.http_api.add_routes(
            path="/jobs/{id}",
            methods=[apigw.HttpMethod.DELETE],
            integration=integrations.HttpLambdaIntegration("DeleteJobIntegration", delete_job_fn),
            authorizer=jwt_authorizer,
        )

        # ---------------------------------------------------------------
        # Profile — resume upload, checked at onboarding to decide whether
        # a user sees the welcome/upload flow before the board.
        # ---------------------------------------------------------------

        get_profile_fn = lambda_.Function(
            self,
            "GetProfileFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.profile_handlers.get_profile_handler",
            code=services_code,
            role=lambda_role,
            environment=profile_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        create_resume_upload_url_fn = lambda_.Function(
            self,
            "CreateResumeUploadUrlFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.profile_handlers.create_resume_upload_url_handler",
            code=services_code,
            role=lambda_role,
            environment=profile_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        confirm_resume_fn = lambda_.Function(
            self,
            "ConfirmResumeFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.profile_handlers.confirm_resume_handler",
            code=services_code,
            role=lambda_role,
            environment=profile_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        self.http_api.add_routes(
            path="/profile",
            methods=[apigw.HttpMethod.GET],
            integration=integrations.HttpLambdaIntegration("GetProfileIntegration", get_profile_fn),
            authorizer=jwt_authorizer,
        )

        self.http_api.add_routes(
            path="/profile/resume-upload-url",
            methods=[apigw.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration(
                "CreateResumeUploadUrlIntegration", create_resume_upload_url_fn
            ),
            authorizer=jwt_authorizer,
        )

        self.http_api.add_routes(
            path="/profile/resume",
            methods=[apigw.HttpMethod.PUT],
            integration=integrations.HttpLambdaIntegration(
                "ConfirmResumeIntegration", confirm_resume_fn
            ),
            authorizer=jwt_authorizer,
        )

        save_preferences_fn = lambda_.Function(
            self,
            "SavePreferencesFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.profile_handlers.save_preferences_handler",
            code=services_code,
            role=lambda_role,
            environment=profile_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        self.http_api.add_routes(
            path="/profile/preferences",
            methods=[apigw.HttpMethod.PUT],
            integration=integrations.HttpLambdaIntegration(
                "SavePreferencesIntegration", save_preferences_fn
            ),
            authorizer=jwt_authorizer,
        )

        create_avatar_upload_url_fn = lambda_.Function(
            self,
            "CreateAvatarUploadUrlFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.profile_handlers.create_avatar_upload_url_handler",
            code=services_code,
            role=lambda_role,
            environment=profile_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        confirm_avatar_fn = lambda_.Function(
            self,
            "ConfirmAvatarFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="api.profile_handlers.confirm_avatar_handler",
            code=services_code,
            role=lambda_role,
            environment=profile_fn_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        self.http_api.add_routes(
            path="/profile/avatar-upload-url",
            methods=[apigw.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration(
                "CreateAvatarUploadUrlIntegration", create_avatar_upload_url_fn
            ),
            authorizer=jwt_authorizer,
        )

        self.http_api.add_routes(
            path="/profile/avatar",
            methods=[apigw.HttpMethod.PUT],
            integration=integrations.HttpLambdaIntegration(
                "ConfirmAvatarIntegration", confirm_avatar_fn
            ),
            authorizer=jwt_authorizer,
        )

        cdk.CfnOutput(
            self,
            "HttpApiEndpoint",
            value=self.http_api.url or "N/A",
            export_name=f"jobhunter-api-{env_name}",
        )

        cdk.CfnOutput(
            self,
            "WebSocketUrl",
            value=f"wss://{self.websocket_api.api_id}.execute-api.{self.region}.amazonaws.com/{self.websocket_stage.stage_name}",
            export_name=f"jobhunter-ws-{env_name}",
        )
