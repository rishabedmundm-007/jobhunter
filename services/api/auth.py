import json
import base64
from typing import Dict, Any

def get_user_from_token(event: Dict[str, Any]) -> str:
    auth_header = event.get('headers', {}).get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise ValueError('Missing or invalid Authorization header')
    token = auth_header[7:]
    try:
        payload = token.split('.')[1]
        padding = 4 - (len(payload) % 4)
        payload += '=' * padding
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        return claims['sub']
    except Exception as e:
        raise ValueError(f'Failed to decode token: {e}')
