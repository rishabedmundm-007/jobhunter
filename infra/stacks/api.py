"""REST and WebSocket API stack."""

import aws_cdk as cdk
from aws_cdk import aws_apigatewayv2 as apigw
from constructs import Construct


class ApiStack(cdk.Stack):
    """Manages API Gateway HTTP API and WebSocket API."""

    def __init__(self, scope: Construct, id: str, env_name: str, auth_stack, data_stack, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name
        self.auth_stack = auth_stack
        self.data_stack = data_stack

        # HTTP API (placeholder)
        self.http_api = apigw.HttpApi(
            self,
            "HttpApi",
            api_name=f"jobhunter-api-{env_name}",
        )

        cdk.CfnOutput(
            self,
            "HttpApiEndpoint",
            value=self.http_api.url or "N/A",
            export_name=f"jobhunter-api-{env_name}",
        )
