"""EventBridge scheduler and Step Functions pipeline stack."""

import aws_cdk as cdk
from constructs import Construct


class PipelineStack(cdk.Stack):
    """Manages the hourly job ingestion and application pipeline."""

    def __init__(self, scope: Construct, id: str, env_name: str, data_stack, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name
        self.data_stack = data_stack

        # Placeholder for EventBridge scheduler and Step Functions
        cdk.CfnOutput(
            self,
            "PipelineStatus",
            value="Pipeline stack placeholder — implementation in Phase 1–4",
        )
