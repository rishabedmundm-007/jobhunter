from typing import Any, Dict

from shared.cognito import get_user_sub


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    """REQUEST authorizer for the $connect route.

    Verifies the token against Cognito and stashes the sub in the returned
    context, which API Gateway persists and replays on requestContext.authorizer
    for every subsequent route on the connection (including $disconnect).
    """
    token = (event.get("queryStringParameters") or {}).get("token", "")
    user_sub = None
    if token:
        try:
            user_sub = get_user_sub(token)
        except Exception:
            user_sub = None

    effect = "Allow" if user_sub else "Deny"
    return {
        "principalId": user_sub or "unauthorized",
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": event["methodArn"],
                }
            ],
        },
        "context": {"user_sub": user_sub or ""},
    }
