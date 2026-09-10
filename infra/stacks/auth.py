"""Cognito User Pool and identity stack."""

import aws_cdk as cdk
from aws_cdk import aws_cognito as cognito
from constructs import Construct


class AuthStack(cdk.Stack):
    """Manages authentication via Cognito User Pool."""

    def __init__(self, scope: Construct, id: str, env_name: str, **kwargs):
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
        )

        # User pool client
        self.user_pool_client = self.user_pool.add_client(
            "WebClient",
            generate_secret=False,
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
