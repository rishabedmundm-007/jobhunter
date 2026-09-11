"""Shared helper for the pip-installed dependency layer new Lambdas need
(httpx, pypdf, python-docx) — existing handlers only ever needed boto3, which
ships with the Lambda runtime for free, so this bundling step didn't exist before.
"""

import aws_cdk as cdk
from aws_cdk import aws_lambda as lambda_
from constructs import Construct


def create_dependencies_layer(scope: Construct, id: str) -> lambda_.LayerVersion:
    return lambda_.LayerVersion(
        scope,
        id,
        code=lambda_.Code.from_asset(
            "../services",
            bundling=cdk.BundlingOptions(
                image=lambda_.Runtime.PYTHON_3_12.bundling_image,
                command=[
                    "bash",
                    "-c",
                    "pip install -r requirements.txt -t /asset-output/python",
                ],
            ),
        ),
        compatible_runtimes=[lambda_.Runtime.PYTHON_3_12],
        description="httpx, pypdf, python-docx for resume parsing/structuring and API-source ingestion",
    )
