import boto3
import os
from typing import Any, Dict, List, Optional

ddb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
TABLE_NAME = os.environ.get("TABLE_NAME", "jobhunter-main-dev")
table = ddb.Table(TABLE_NAME)


def create_job(user_sub: str, job_id: str, job_data: Dict[str, Any]) -> Dict:
    item = {"PK": f"USER#{user_sub}", "SK": f"JOB#{job_id}", **job_data}
    table.put_item(Item=item)
    return item


def get_jobs(user_sub: str, state: Optional[str] = None, limit: int = 50) -> List[Dict]:
    if state:
        response = table.query(
            IndexName="GSI1",
            KeyConditionExpression="GSI1PK = :pk",
            ExpressionAttributeValues={":pk": f"USER#{user_sub}#STATE#{state}"},
            Limit=limit,
            ScanIndexForward=False,
        )
    else:
        response = table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues={":pk": f"USER#{user_sub}", ":sk": "JOB#"},
            Limit=limit,
            ScanIndexForward=False,
        )
    return response.get("Items", [])


def update_job(user_sub: str, job_id: str, updates: Dict[str, Any]) -> Dict:
    # Attribute name placeholders avoid collisions with reserved words (e.g. "state").
    update_expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates.keys())
    response = table.update_item(
        Key={"PK": f"USER#{user_sub}", "SK": f"JOB#{job_id}"},
        UpdateExpression=update_expr,
        ExpressionAttributeNames={f"#{k}": k for k in updates.keys()},
        ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
        ReturnValues="ALL_NEW",
    )
    return response["Attributes"]


def delete_job(user_sub: str, job_id: str) -> None:
    table.delete_item(Key={"PK": f"USER#{user_sub}", "SK": f"JOB#{job_id}"})


def get_profile(user_sub: str) -> Optional[Dict]:
    response = table.get_item(Key={"PK": f"USER#{user_sub}", "SK": "PROFILE"})
    return response.get("Item")


def update_profile(user_sub: str, updates: Dict[str, Any]) -> Dict:
    key = {"PK": f"USER#{user_sub}", "SK": "PROFILE"}
    update_expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates.keys())
    response = table.update_item(
        Key=key,
        UpdateExpression=update_expr,
        ExpressionAttributeNames={f"#{k}": k for k in updates.keys()},
        ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
        ReturnValues="ALL_NEW",
    )
    return response["Attributes"]


def create_connection(user_sub: str, connection_id: str, ttl: int) -> None:
    table.put_item(Item={"PK": f"USER#{user_sub}", "SK": f"CONNECTION#{connection_id}", "ttl": ttl})


def get_connections(user_sub: str) -> List[str]:
    response = table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={":pk": f"USER#{user_sub}", ":sk": "CONNECTION#"},
    )
    return [item["SK"].split("#")[1] for item in response.get("Items", [])]


def delete_connection(user_sub: str, connection_id: str) -> None:
    table.delete_item(Key={"PK": f"USER#{user_sub}", "SK": f"CONNECTION#{connection_id}"})
