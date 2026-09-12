import json
from decimal import Decimal


class DecimalEncoder(json.JSONEncoder):
    """DynamoDB returns Decimal for every number, which plain json.dumps can't
    serialize — needed wherever a DB item flows straight into an HTTP response
    or a WebSocket push."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)
