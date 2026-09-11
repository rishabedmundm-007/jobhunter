import time
from typing import Any, Dict

from shared.ddb import create_connection


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        connection_id = event["requestContext"]["connectionId"]
        user_sub = event["requestContext"]["authorizer"]["user_sub"]
        ttl = int(time.time()) + 3600
        create_connection(user_sub, connection_id, ttl)
        return {"statusCode": 200, "body": "Connected"}
    except Exception as e:
        return {"statusCode": 400, "body": str(e)}
