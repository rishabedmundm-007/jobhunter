import aws_cdk as cdk
from aws_cdk import (
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_certificatemanager as acm,
)
from constructs import Construct

# Certificate requested out-of-band via ACM (must live in us-east-1 for CloudFront)
# for the jobsperch.com custom domain.
SITE_CERTIFICATE_ARN = (
    "arn:aws:acm:us-east-1:816079798423:certificate/6c0889ab-10cc-4a4a-9be7-d48fd1a0f611"
)
SITE_DOMAIN_NAMES = ["jobsperch.com", "www.jobsperch.com"]


class WebStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, env_name: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name
        self.domain_names = SITE_DOMAIN_NAMES

        self.web_bucket = s3.Bucket(
            self,
            "WebBucket",
            bucket_name=f"jobhunter-web-{self.account}-{env_name}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
        )

        certificate = acm.Certificate.from_certificate_arn(
            self, "SiteCertificate", SITE_CERTIFICATE_ARN
        )

        self.distribution = cloudfront.Distribution(
            self,
            "WebDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(self.web_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                compress=True,
            ),
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            domain_names=self.domain_names,
            certificate=certificate,
            # Client-side routes (e.g. /board/state/APPLIED) have no matching S3
            # object — a direct hit or refresh on one is a real HTTP request for
            # that path, which S3 would 403 on. Fall back to index.html (as a
            # real 200, not a redirect) so the SPA loads and React Router takes
            # over client-side.
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
            ],
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

        cdk.CfnOutput(
            self,
            "SiteUrl",
            value=f"https://{self.domain_names[0]}",
            export_name=f"jobhunter-site-url-{env_name}",
        )

        cdk.CfnOutput(
            self,
            "DistributionId",
            value=self.distribution.distribution_id,
            export_name=f"jobhunter-web-distid-{env_name}",
        )
