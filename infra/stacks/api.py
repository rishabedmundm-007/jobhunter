import aws_cdk as cdk
from aws_cdk import (
    aws_apigatewayv2 as apigw,
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

        self.http_api = apigw.HttpApi(
            self,
            "HttpApi",
            api_name=f"jobhunter-api-{env_name}",
        )

        lambda_role = iam.Role(
            self,
            "LambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )
        lambda_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
        )
        self.data_stack.main_table.grant_read_write_data(lambda_role)

        create_job_fn = lambda_.Function(
            self,
            "CreateJobFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="services.api.handlers.create_job_handler",
            code=lambda_.Code.from_asset(".."),
            role=lambda_role,
            environment={"TABLE_NAME": self.data_stack.main_table.table_name},
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        get_jobs_fn = lambda_.Function(
            self,
            "GetJobsFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="services.api.handlers.get_jobs_handler",
            code=lambda_.Code.from_asset(".."),
            role=lambda_role,
            environment={"TABLE_NAME": self.data_stack.main_table.table_name},
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        update_job_fn = lambda_.Function(
            self,
            "UpdateJobFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="services.api.handlers.update_job_handler",
            code=lambda_.Code.from_asset(".."),
            role=lambda_role,
            environment={"TABLE_NAME": self.data_stack.main_table.table_name},
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        delete_job_fn = lambda_.Function(
            self,
            "DeleteJobFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="services.api.handlers.delete_job_handler",
            code=lambda_.Code.from_asset(".."),
            role=lambda_role,
            environment={"TABLE_NAME": self.data_stack.main_table.table_name},
            timeout=cdk.Duration.seconds(30),
            memory_size=512,
        )

        self.http_api.add_routes(
            path="/jobs",
            methods=[apigw.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration("CreateJobIntegration", create_job_fn),
        )

        self.http_api.add_routes(
            path="/jobs",
            methods=[apigw.HttpMethod.GET],
            integration=integrations.HttpLambdaIntegration("GetJobsIntegration", get_jobs_fn),
        )

        self.http_api.add_routes(
            path="/jobs/{id}",
            methods=[apigw.HttpMethod.PUT],
            integration=integrations.HttpLambdaIntegration("UpdateJobIntegration", update_job_fn),
        )

        self.http_api.add_routes(
            path="/jobs/{id}",
            methods=[apigw.HttpMethod.DELETE],
            integration=integrations.HttpLambdaIntegration("DeleteJobIntegration", delete_job_fn),
        )

        cdk.CfnOutput(
            self,
            "HttpApiEndpoint",
            value=self.http_api.url or "N/A",
            export_name=f"jobhunter-api-{env_name}",
        )
