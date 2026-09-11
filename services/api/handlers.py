import json
import uuid
from datetime import datetime
from typing import Dict, Any

from .auth import get_user_from_token
from shared.ddb import create_job, get_jobs, update_job, delete_job
from shared.broadcast import broadcast_to_user
from shared.http import response


def create_job_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        body = json.loads(event.get("body", "{}"))
        job_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        state = body.get("state", "DISCOVERED")
        job_data = {
            "title": body["title"],
            "company": body["company"],
            "link": body.get("link"),
            "state": state,
            "user_sub": user_sub,
            "created_at": now,
            "updated_at": now,
            "GSI1PK": f"USER#{user_sub}#STATE#{state}",
            "GSI1SK": now,
        }
        item = create_job(user_sub, job_id, job_data)
        item["id"] = job_id
        broadcast_to_user(user_sub, {"type": "job:updated", "payload": item})
        return response(201, item)
    except KeyError as e:
        return response(400, {"error": f"Missing required field: {e}"})
    except Exception as e:
        return response(400, {"error": str(e)})


def get_jobs_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        query_params = event.get("queryStringParameters", {}) or {}
        state = query_params.get("state")
        limit = int(query_params.get("limit", 50))
        jobs = get_jobs(user_sub, state, limit)
        for job in jobs:
            job["id"] = job["SK"].split("#")[1]
        return response(200, jobs)
    except Exception as e:
        return response(400, {"error": str(e)})


def update_job_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        job_id = event["pathParameters"]["id"]
        body = json.loads(event.get("body", "{}"))
        updates = {
            k: v for k, v in body.items() if k in ["state", "title", "company", "notes", "link"]
        }
        updates["updated_at"] = datetime.utcnow().isoformat()
        if "state" in updates:
            updates["GSI1PK"] = f'USER#{user_sub}#STATE#{updates["state"]}'
            updates["GSI1SK"] = updates["updated_at"]
        item = update_job(user_sub, job_id, updates)
        item["id"] = job_id
        broadcast_to_user(user_sub, {"type": "job:updated", "payload": item})
        return response(200, item)
    except Exception as e:
        return response(400, {"error": str(e)})


def delete_job_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        job_id = event["pathParameters"]["id"]
        delete_job(user_sub, job_id)
        broadcast_to_user(user_sub, {"type": "job:deleted", "payload": {"id": job_id}})
        return response(200, {"id": job_id, "deleted": True})
    except Exception as e:
        return response(400, {"error": str(e)})
