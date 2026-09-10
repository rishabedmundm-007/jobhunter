from typing import Dict, Any

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        return {'statusCode': 200, 'body': 'Disconnected'}
    except Exception as e:
        return {'statusCode': 400, 'body': str(e)}
