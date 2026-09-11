from typing import Any, Dict

from shared.ddb import delete_connection


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        connection_id = event["requestContext"]["connectionId"]
        user_sub = event["requestContext"]["authorizer"]["user_sub"]
        delete_connection(user_sub, connection_id)
        return {"statusCode": 200, "body": "Disconnected"}
    except Exception as e:
        return {"statusCode": 400, "body": str(e)}
