"""CloudFront and S3 static website stack."""

import aws_cdk as cdk
from aws_cdk import aws_s3 as s3
from constructs import Construct


class WebStack(cdk.Stack):
    """Manages the React SPA hosting on S3 + CloudFront."""

    def __init__(self, scope: Construct, id: str, env_name: str, api_stack, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name
        self.api_stack = api_stack

        # S3 bucket for static assets
        self.web_bucket = s3.Bucket(
            self,
            "WebBucket",
            bucket_name=f"jobhunter-web-{self.account}-{env_name}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # CloudFront distribution (placeholder)
        cdk.CfnOutput(
            self,
            "WebBucketName",
            value=self.web_bucket.bucket_name,
        )
