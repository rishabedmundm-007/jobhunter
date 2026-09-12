import hashlib
import re
import boto3
import os
from botocore.exceptions import ClientError
from decimal import Decimal
from typing import Any, Dict, List, Optional

ddb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
TABLE_NAME = os.environ.get("TABLE_NAME", "jobhunter-main-dev")
table = ddb.Table(TABLE_NAME)


def _dynamo_safe(value: Any) -> Any:
    """DynamoDB's boto3 Table resource rejects native Python floats outright
    ("Float types are not supported. Use Decimal types instead.") — this bites
    anything numeric that isn't an int: match scores, embedding vectors, etc.
    Recursively convert via str() to avoid binary-float rounding artifacts."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _dynamo_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_dynamo_safe(v) for v in value]
    return value


def create_job(user_sub: str, job_id: str, job_data: Dict[str, Any]) -> Dict:
    item = _dynamo_safe({"PK": f"USER#{user_sub}", "SK": f"JOB#{job_id}", **job_data})
    table.put_item(Item=item)
    return item


def job_id_from_source(source: str, external_id: str) -> str:
    """Deterministic job identity so re-ingesting the same posting is a no-op."""
    return hashlib.sha256(f"{source}:{external_id}".encode()).hexdigest()[:32]


def content_fingerprint(title: str, company: str) -> str:
    """Identity for the same real-world posting across *different* sources —
    (source, external_id) alone can't catch this, since e.g. JSearch (which
    aggregates Google for Jobs) and Adzuna can both surface the identical
    posting under two unrelated external IDs. Deliberately coarse (title +
    company only, no location — location strings are inconsistent/missing
    across sources) so it fails safe toward merging rather than toward
    letting a real duplicate through and risking a second application to a
    job already applied to, skipped, or otherwise finalized."""

    def normalize(s: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

    return hashlib.sha256(f"{normalize(title)}|{normalize(company)}".encode()).hexdigest()[:32]


def claim_content_fingerprint(user_sub: str, fingerprint: str) -> bool:
    """Returns True the first time this fingerprint is seen for this user
    (and durably claims it), False on every subsequent attempt — regardless
    of what happened to the original job (applied/skipped/filtered out), so
    a re-discovered duplicate can never re-enter the pipeline under a new
    source's job id."""
    try:
        table.put_item(
            Item={"PK": f"USER#{user_sub}", "SK": f"FINGERPRINT#{fingerprint}"},
            ConditionExpression="attribute_not_exists(PK)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def upsert_discovered_job(user_sub: str, job_id: str, job_data: Dict[str, Any]) -> bool:
    """Insert a newly-discovered job iff it isn't already known.

    Returns True if inserted, False if it already existed (a no-op — this preserves
    any state/notes the user already set on a job we've seen before).
    """
    item = _dynamo_safe({"PK": f"USER#{user_sub}", "SK": f"JOB#{job_id}", **job_data})
    try:
        table.put_item(Item=item, ConditionExpression="attribute_not_exists(PK)")
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def get_job(user_sub: str, job_id: str) -> Optional[Dict]:
    response = table.get_item(Key={"PK": f"USER#{user_sub}", "SK": f"JOB#{job_id}"})
    return response.get("Item")


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
    updates = _dynamo_safe(updates)
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
    updates = _dynamo_safe(updates)
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


def get_shortlisted_jobs_missing_resume(user_sub: str) -> List[Dict]:
    """Backlog-aware tailoring input: every SHORTLISTED job with no tailored resume yet,
    not just ones discovered this run."""
    jobs = get_jobs(user_sub, state="SHORTLISTED", limit=1000)
    return [j for j in jobs if not j.get("tailored_resume_key")]


def put_resume_version(user_sub: str, job_id: str, resume_data: Dict[str, Any]) -> Dict:
    item = _dynamo_safe({"PK": f"USER#{user_sub}", "SK": f"RESUME#{job_id}", **resume_data})
    table.put_item(Item=item)
    return item


def put_run(user_sub: str, run_id: str, run_data: Dict[str, Any]) -> Dict:
    item = _dynamo_safe({"PK": f"USER#{user_sub}", "SK": f"RUN#{run_id}", **run_data})
    table.put_item(Item=item)
    return item


def list_active_profiles() -> List[Dict]:
    """Users who've completed onboarding (resume + preferences set) — the dispatcher's
    candidate list. A plain filtered Scan is fine at this user scale."""
    scan_kwargs = {
        "FilterExpression": "SK = :sk AND attribute_exists(resume_key) AND attribute_exists(job_roles)",
        "ExpressionAttributeValues": {":sk": "PROFILE"},
    }
    items: List[Dict] = []
    response = table.scan(**scan_kwargs)
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = table.scan(**scan_kwargs, ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items
