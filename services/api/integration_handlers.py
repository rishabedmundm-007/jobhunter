import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

import boto3

from .auth import get_user_from_token
from shared.ddb import get_integration, put_integration
from shared.http import response

ssm = boto3.client("ssm")
ENV_NAME = os.environ.get("ENV_NAME", "dev")
PROVIDERS = {"linkedin", "indeed"}


def _param_name(user_sub: str, provider: str) -> str:
    return f"/jobhunter/{ENV_NAME}/users/{user_sub}/{provider}"


def save_integration_credentials_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        provider = event["pathParameters"]["provider"]
        if provider not in PROVIDERS:
            return response(400, {"error": f"Unknown provider: {provider}"})

        body = json.loads(event.get("body", "{}"))
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        if not username or not password:
            return response(400, {"error": "Username and password are required."})

        ssm.put_parameter(
            Name=_param_name(user_sub, provider),
            Value=json.dumps({"username": username, "password": password}),
            Type="SecureString",
            Overwrite=True,
        )
        put_integration(
            user_sub,
            provider,
            {
                "status": "valid",
                "last_checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return response(200, {"provider": provider, "connected": True})
    except KeyError as e:
        return response(400, {"error": f"Missing required field: {e}"})
    except Exception as e:
        return response(400, {"error": str(e)})


def get_integrations_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        result = {}
        for provider in PROVIDERS:
            item = get_integration(user_sub, provider)
            result[provider] = {
                "connected": bool(item),
                "status": item.get("status") if item else None,
            }
        return response(200, result)
    except Exception as e:
        return response(400, {"error": str(e)})
