"""CloudWatch, logs, and monitoring stack."""

import aws_cdk as cdk
from aws_cdk import aws_logs as logs
from constructs import Construct


class ObservabilityStack(cdk.Stack):
    """Manages CloudWatch logs, alarms, and dashboards."""

    def __init__(self, scope: Construct, id: str, env_name: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name

        # Log group for Lambda functions
        self.lambda_log_group = logs.LogGroup(
            self,
            "LambdaLogs",
            log_group_name=f"/aws/lambda/jobhunter-{env_name}",
            retention=logs.RetentionDays.TWO_WEEKS,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        cdk.CfnOutput(
            self,
            "LogGroupName",
            value=self.lambda_log_group.log_group_name,
        )
