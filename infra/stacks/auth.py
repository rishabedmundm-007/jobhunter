"""Cognito User Pool and identity stack."""

import aws_cdk as cdk
from aws_cdk import aws_cognito as cognito
from constructs import Construct

# Verified via SES for sending Cognito's signup/verification emails from a real
# domain instead of Cognito's default (unreliable) sender.
SES_VERIFIED_DOMAIN = "jobsperch.com"
SES_FROM_EMAIL = f"noreply@{SES_VERIFIED_DOMAIN}"


class AuthStack(cdk.Stack):
    """Manages authentication via Cognito User Pool."""

    def __init__(
        self,
        scope: Construct,
        id: str,
        env_name: str,
        cloudfront_domain: str,
        custom_domains: list[str] | None = None,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name

        # User pool
        self.user_pool = cognito.UserPool(
            self,
            "UserPool",
            user_pool_name=f"jobhunter-{env_name}",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            mfa=cognito.Mfa.OPTIONAL,
            password_policy=cognito.PasswordPolicy(
                min_length=12,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
            ),
            email=cognito.UserPoolEmail.with_ses(
                from_email=SES_FROM_EMAIL,
                from_name="JobHunter",
                ses_verified_domain=SES_VERIFIED_DOMAIN,
                ses_region="us-east-1",
            ),
        )

        # Hosted UI needs to redirect back to the deployed SPA (custom domain,
        # CloudFront domain, and localhost for local dev).
        callback_urls = [
            f"https://{cloudfront_domain}",
            f"https://{cloudfront_domain}/",
            "http://localhost:5173",
            "http://localhost:5173/",
        ]
        for domain in custom_domains or []:
            callback_urls += [f"https://{domain}", f"https://{domain}/"]

        # User pool client
        self.user_pool_client = self.user_pool.add_client(
            "WebClient",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(user_password=True, admin_user_password=True),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=callback_urls,
                logout_urls=callback_urls,
            ),
            supported_identity_providers=[cognito.UserPoolClientIdentityProvider.COGNITO],
        )

        # Hosted UI domain
        self.domain = self.user_pool.add_domain(
            "Domain",
            cognito_domain=cognito.CognitoDomainOptions(domain_prefix=f"jobhunter-{env_name}"),
        )

        cdk.CfnOutput(
            self,
            "UserPoolId",
            value=self.user_pool.user_pool_id,
            export_name=f"jobhunter-userpool-{env_name}",
        )
        cdk.CfnOutput(
            self,
            "UserPoolClientId",
            value=self.user_pool_client.user_pool_client_id,
            export_name=f"jobhunter-userpool-client-{env_name}",
        )
        cdk.CfnOutput(
            self,
            "CognitoDomain",
            value=f"{self.domain.domain_name}.auth.{self.region}.amazoncognito.com",
            export_name=f"jobhunter-cognito-domain-{env_name}",
        )
