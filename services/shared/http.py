import json
from typing import Any, Dict

from shared.json_utils import DecimalEncoder


def response(status_code: int, body: Any) -> Dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, cls=DecimalEncoder) if not isinstance(body, str) else body,
    }
