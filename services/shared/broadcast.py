import json
import os
from typing import Any, Dict

import boto3

from shared.ddb import get_connections, delete_connection


def broadcast_to_user(user_sub: str, message: Dict[str, Any]) -> None:
    """Push a message to every open WebSocket connection for a user, pruning dead ones."""
    endpoint = os.environ.get("WS_ENDPOINT")
    if not endpoint:
        return
    client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint)
    data = json.dumps(message).encode("utf-8")
    for connection_id in get_connections(user_sub):
        try:
            client.post_to_connection(ConnectionId=connection_id, Data=data)
        except client.exceptions.GoneException:
            delete_connection(user_sub, connection_id)
