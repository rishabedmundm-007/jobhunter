import json
import time
from typing import Dict, Any
import sys
sys.path.insert(0, '/opt/python')

from shared.ddb import create_connection

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        connection_id = event['requestContext']['connectionId']
        query_params = event.get('queryStringParameters', {}) or {}
        token = query_params.get('token', '')
        if not token:
            return {'statusCode': 401, 'body': 'Unauthorized'}
        import base64
        payload = token.split('.')[1]
        padding = 4 - (len(payload) % 4)
        payload += '=' * padding
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        user_sub = claims['sub']
        ttl = int(time.time()) + 3600
        create_connection(user_sub, connection_id, ttl)
        return {'statusCode': 200, 'body': 'Connected'}
    except Exception as e:
        return {'statusCode': 400, 'body': str(e)}
