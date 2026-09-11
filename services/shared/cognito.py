import boto3

_client = boto3.client("cognito-idp")


def get_user_sub(access_token: str) -> str:
    """Resolve an access token to its user's sub via Cognito, verifying it in the process.

    GetUser calls Cognito directly, so an invalid, expired, or revoked token
    raises instead of silently returning a forged identity.
    """
    resp = _client.get_user(AccessToken=access_token)
    for attr in resp["UserAttributes"]:
        if attr["Name"] == "sub":
            return attr["Value"]
    raise ValueError("sub attribute not present on user")
