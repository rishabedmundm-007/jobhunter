import aws_cdk as cdk
from aws_cdk import (
    aws_lambda as lambda_,
    aws_ecr_assets as ecr_assets,
    aws_iam as iam,
    aws_logs as logs,
    aws_stepfunctions as sfn,
    aws_stepfunctions_tasks as tasks,
    aws_scheduler as scheduler,
)
from constructs import Construct

from ._lambda_layer import create_dependencies_layer

# Mon-Fri, 08:01/10:01/12:01/14:01/16:01 US Eastern — DST-safe via the Scheduler's
# own timezone resolution, no manual UTC-offset math.
SCHEDULE_EXPRESSION = "cron(1 8-16/2 ? * MON-FRI *)"
SCHEDULE_TIMEZONE = "America/New_York"


class PipelineStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, env_name: str, data_stack, api_stack, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name
        self.data_stack = data_stack

        services_code = lambda_.Code.from_asset("../services")
        deps_layer = create_dependencies_layer(self, "PipelineDependenciesLayer")

        pipeline_role = iam.Role(
            self,
            "PipelineLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )
        pipeline_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "service-role/AWSLambdaBasicExecutionRole"
            )
        )
        data_stack.main_table.grant_read_write_data(pipeline_role)
        data_stack.bucket.grant_read_write(pipeline_role)
        pipeline_role.add_to_policy(
            iam.PolicyStatement(
                actions=["bedrock:InvokeModel"],
                # Claude Haiku 4.5 is invoked via a cross-region inference profile,
                # which can route to underlying foundation models in other regions
                # within the profile — both resource types need to be covered.
                resources=[
                    "arn:aws:bedrock:*::foundation-model/*",
                    f"arn:aws:bedrock:*:{self.account}:inference-profile/*",
                ],
            )
        )
        pipeline_role.add_to_policy(
            iam.PolicyStatement(
                actions=["ssm:GetParameter"],
                resources=[
                    f"arn:aws:ssm:{self.region}:{self.account}:parameter/jobhunter/{env_name}/*",
                ],
            )
        )

        # So the finalize step can broadcast "pipeline:completed" over the same
        # WebSocket connections the interactive API uses (shared.broadcast).
        ws_endpoint = (
            f"https://{api_stack.websocket_api.api_id}.execute-api.{self.region}.amazonaws.com/"
            f"{api_stack.websocket_stage.stage_name}"
        )
        ws_management_arn = self.format_arn(
            service="execute-api",
            resource=api_stack.websocket_api.api_id,
            resource_name=f"{api_stack.websocket_stage.stage_name}/POST/@connections/*",
            arn_format=cdk.ArnFormat.SLASH_RESOURCE_NAME,
        )
        pipeline_role.add_to_policy(
            iam.PolicyStatement(
                actions=["execute-api:ManageConnections"], resources=[ws_management_arn]
            )
        )

        common_env = {
            "TABLE_NAME": data_stack.main_table.table_name,
            "BUCKET_NAME": data_stack.bucket.bucket_name,
            "ENV_NAME": env_name,
        }

        api_adapters_fn = lambda_.Function(
            self,
            "ApiAdaptersFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="ingest.api_adapters.lambda_handler",
            code=services_code,
            role=pipeline_role,
            environment=common_env,
            layers=[deps_layer],
            timeout=cdk.Duration.minutes(5),
            memory_size=512,
        )

        browser_adapter_fn = lambda_.DockerImageFunction(
            self,
            "BrowserAdapterFunction",
            code=lambda_.DockerImageCode.from_image_asset(
                "../services",
                file="ingest/browser_adapter/Dockerfile",
                # Pinned explicitly so the build is reproducible regardless of the
                # host machine's native architecture (not left to Docker's default,
                # which silently mismatched Lambda's default X86_64 architecture
                # and failed at cold start with "Runtime.InvalidEntrypoint").
                platform=ecr_assets.Platform.LINUX_ARM64,
            ),
            architecture=lambda_.Architecture.ARM_64,
            role=pipeline_role,
            environment=common_env,
            timeout=cdk.Duration.minutes(15),
            # 2048MB proved marginal for Chromium running two browser contexts —
            # Lambda scales allocated vCPU with memory, so more memory here also
            # means a faster, more stable Chromium, not just headroom.
            memory_size=3008,
            ephemeral_storage_size=cdk.Size.gibibytes(2),
        )

        match_fn = lambda_.Function(
            self,
            "MatchFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="match.handler.lambda_handler",
            code=services_code,
            role=pipeline_role,
            environment=common_env,
            layers=[deps_layer],
            timeout=cdk.Duration.minutes(5),
            memory_size=512,
        )

        tailor_fn = lambda_.Function(
            self,
            "TailorFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="tailor.handler.lambda_handler",
            code=services_code,
            role=pipeline_role,
            environment=common_env,
            layers=[deps_layer],
            timeout=cdk.Duration.minutes(2),
            memory_size=512,
        )

        finalize_fn = lambda_.Function(
            self,
            "FinalizeFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="dispatch.finalize.lambda_handler",
            code=services_code,
            role=pipeline_role,
            environment={**common_env, "WS_ENDPOINT": ws_endpoint},
            timeout=cdk.Duration.seconds(30),
            memory_size=256,
        )

        # ---------------------------------------------------------------
        # Step Functions Express: one execution per active user.
        # ---------------------------------------------------------------

        # Each source is independent and best-effort — a Parallel state fails its
        # whole execution if any one branch throws, which would let the fragile,
        # disclosed-as-fragile browser adapter (§ADR-0003 override) take down the
        # legitimate API sources too. Catch each branch so one source's outage
        # never blocks the others.
        empty_ingest_result = {"sources_run": [], "ingested_count": 0, "errors": ["adapter_failed"]}

        ingest_api_task = tasks.LambdaInvoke(
            self, "IngestApiSources", lambda_function=api_adapters_fn, payload_response_only=True
        )
        ingest_api_task.add_catch(
            sfn.Pass(self, "ApiSourcesFailed", result=sfn.Result.from_object(empty_ingest_result)),
            errors=["States.ALL"],
        )

        ingest_browser_task = tasks.LambdaInvoke(
            self,
            "IngestBrowserSources",
            lambda_function=browser_adapter_fn,
            payload_response_only=True,
        )
        ingest_browser_task.add_catch(
            sfn.Pass(
                self, "BrowserSourcesFailed", result=sfn.Result.from_object(empty_ingest_result)
            ),
            errors=["States.ALL"],
        )

        ingest_parallel = sfn.Parallel(self, "IngestSources", result_path="$.ingest_results")
        ingest_parallel.branch(ingest_api_task)
        ingest_parallel.branch(ingest_browser_task)

        match_task = tasks.LambdaInvoke(
            self,
            "MatchAndShortlist",
            lambda_function=match_fn,
            payload=sfn.TaskInput.from_object({"user_sub": sfn.JsonPath.string_at("$.user_sub")}),
            result_path="$.match_result",
            payload_response_only=True,
        )

        tailor_task = tasks.LambdaInvoke(
            self, "TailorJob", lambda_function=tailor_fn, payload_response_only=True
        )
        tailor_map = sfn.Map(
            self,
            "TailorShortlisted",
            items_path=sfn.JsonPath.string_at("$.match_result.tailor_job_ids"),
            item_selector={
                "user_sub.$": "$.user_sub",
                "job_id.$": "$$.Map.Item.Value",
            },
            result_path="$.tailor_results",
            max_concurrency=2,
        )
        tailor_map.item_processor(tailor_task)

        finalize_task = tasks.LambdaInvoke(
            self, "FinalizeRun", lambda_function=finalize_fn, payload_response_only=True
        )

        definition = ingest_parallel.next(match_task).next(tailor_map).next(finalize_task)

        # Express workflows don't retain queryable execution history the way
        # Standard ones do — CloudWatch Logs is the only way to see what a run
        # actually did, so this is load-bearing for debugging, not optional.
        state_machine_log_group = logs.LogGroup(
            self,
            "StateMachineLogs",
            log_group_name=f"/aws/vendedlogs/states/jobhunter-pipeline-{env_name}",
            retention=logs.RetentionDays.TWO_WEEKS,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        state_machine = sfn.StateMachine(
            self,
            "JobPipelineStateMachine",
            state_machine_name=f"jobhunter-pipeline-{env_name}",
            definition_body=sfn.DefinitionBody.from_chainable(definition),
            state_machine_type=sfn.StateMachineType.EXPRESS,
            timeout=cdk.Duration.minutes(15),
            logs=sfn.LogOptions(destination=state_machine_log_group, level=sfn.LogLevel.ALL),
        )

        # ---------------------------------------------------------------
        # Dispatcher: fans the schedule out to one execution per active user.
        # ---------------------------------------------------------------

        # A dedicated role (not pipeline_role) — sharing pipeline_role here would
        # create a circular CloudFormation dependency: dispatcher's start-execution
        # grant needs the state machine's ARN, while the state machine's own role
        # needs invoke permission on match/tailor/etc., which use pipeline_role.
        dispatcher_role = iam.Role(
            self,
            "DispatcherLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )
        dispatcher_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "service-role/AWSLambdaBasicExecutionRole"
            )
        )
        data_stack.main_table.grant_read_data(dispatcher_role)

        dispatcher_fn = lambda_.Function(
            self,
            "DispatcherFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="dispatch.dispatcher.lambda_handler",
            code=services_code,
            role=dispatcher_role,
            environment={**common_env, "STATE_MACHINE_ARN": state_machine.state_machine_arn},
            timeout=cdk.Duration.minutes(2),
            memory_size=256,
        )
        state_machine.grant_start_execution(dispatcher_fn)

        scheduler_role = iam.Role(
            self,
            "SchedulerRole",
            assumed_by=iam.ServicePrincipal("scheduler.amazonaws.com"),
        )
        dispatcher_fn.grant_invoke(scheduler_role)

        scheduler.CfnSchedule(
            self,
            "PipelineSchedule",
            schedule_expression=SCHEDULE_EXPRESSION,
            schedule_expression_timezone=SCHEDULE_TIMEZONE,
            flexible_time_window=scheduler.CfnSchedule.FlexibleTimeWindowProperty(mode="OFF"),
            target=scheduler.CfnSchedule.TargetProperty(
                arn=dispatcher_fn.function_arn,
                role_arn=scheduler_role.role_arn,
            ),
        )

        cdk.CfnOutput(
            self,
            "StateMachineArn",
            value=state_machine.state_machine_arn,
            export_name=f"jobhunter-pipeline-statemachine-{env_name}",
        )
        cdk.CfnOutput(
            self,
            "PipelineStatus",
            value="Phase 2-3: ingestion, matching, and resume tailoring wired to a scheduled pipeline",
        )
