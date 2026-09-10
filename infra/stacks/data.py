"""DynamoDB and S3 data layer."""

import aws_cdk as cdk
from aws_cdk import aws_dynamodb as ddb, aws_s3 as s3
from constructs import Construct


class DataStack(cdk.Stack):
    """Manages DynamoDB tables and S3 buckets."""

    def __init__(self, scope: Construct, id: str, env_name: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name

        # DynamoDB table (single-table design)
        self.main_table = ddb.Table(
            self,
            "MainTable",
            table_name=f"jobhunter-main-{env_name}",
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            partition_key=ddb.Attribute(name="PK", type=ddb.AttributeType.STRING),
            sort_key=ddb.Attribute(name="SK", type=ddb.AttributeType.STRING),
            point_in_time_recovery=True,
        )

        # GSI for state queries
        self.main_table.add_global_secondary_index(
            index_name="GSI1",
            partition_key=ddb.Attribute(name="GSI1PK", type=ddb.AttributeType.STRING),
            sort_key=ddb.Attribute(name="GSI1SK", type=ddb.AttributeType.STRING),
        )

        # S3 bucket for resumes and files
        self.bucket = s3.Bucket(
            self,
            "DataBucket",
            bucket_name=f"jobhunter-data-{self.account}-{env_name}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            versioned=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
        )

        cdk.CfnOutput(
            self,
            "TableName",
            value=self.main_table.table_name,
            export_name=f"jobhunter-table-{env_name}",
        )
        cdk.CfnOutput(
            self,
            "BucketName",
            value=self.bucket.bucket_name,
            export_name=f"jobhunter-bucket-{env_name}",
        )
