import aws_cdk as cdk
from aws_cdk import (
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
)
from constructs import Construct

class WebStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, env_name: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name

        self.web_bucket = s3.Bucket(
            self,
            "WebBucket",
            bucket_name=f"jobhunter-web-{self.account}-{env_name}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
        )

        oai = cloudfront.OriginAccessIdentity(
            self,
            "WebOAI",
            comment=f"OAI for jobhunter-web-{env_name}",
        )
        self.web_bucket.grant_read(oai)

        self.distribution = cloudfront.Distribution(
            self,
            "WebDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=cloudfront.S3Origin(self.web_bucket, origin_access_identity=oai),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                compress=True,
            ),
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
        )

        cdk.CfnOutput(
            self,
            "WebBucketName",
            value=self.web_bucket.bucket_name,
            export_name=f"jobhunter-web-bucket-{env_name}",
        )

        cdk.CfnOutput(
            self,
            "CloudFrontUrl",
            value=f"https://{self.distribution.domain_name}",
            export_name=f"jobhunter-web-url-{env_name}",
        )
