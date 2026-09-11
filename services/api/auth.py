from typing import Any, Dict


def get_user_from_token(event: Dict[str, Any]) -> str:
    """Read the verified user sub from API Gateway's JWT authorizer context.

    API Gateway validates the token's signature, issuer, and audience against
    the Cognito user pool before invoking the handler, so this claim is trusted.
    """
    try:
        return event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    except KeyError:
        raise ValueError("Missing authorizer claims")
