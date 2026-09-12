"""On-demand, per-job resume tailoring — the user-triggered counterpart to the
pipeline's automatic ingest/match. Tailoring is real Bedrock spend, so it only
ever runs when a user explicitly asks for one specific job, never queued up
automatically for a whole shortlist.
"""

import json
import os
from typing import Any, Dict

import boto3

from .auth import get_user_from_token
from shared.ddb import get_job, get_profile
from shared.http import response

lambda_client = boto3.client("lambda")
TAILOR_FUNCTION_ARN = os.environ["TAILOR_FUNCTION_ARN"]


def trigger_tailor_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        job_id = event["pathParameters"]["id"]

        job = get_job(user_sub, job_id)
        if not job:
            return response(404, {"error": "Job not found."})
        if job.get("state") != "SHORTLISTED":
            return response(400, {"error": "Only shortlisted jobs can have a resume generated."})
        if job.get("tailored_resume_key"):
            return response(400, {"error": "A tailored resume already exists for this job."})

        profile = get_profile(user_sub) or {}
        if not profile.get("base_resume_json"):
            return response(400, {"error": "Upload and confirm your resume before tailoring."})

        # Invoked directly (bypassing Step Functions) — the same TailorFunction
        # code the pipeline used to run in a Map state, just for one job on
        # request instead of a capped backlog on every run.
        lambda_client.invoke(
            FunctionName=TAILOR_FUNCTION_ARN,
            InvocationType="Event",
            Payload=json.dumps({"user_sub": user_sub, "job_id": job_id}).encode("utf-8"),
        )
        return response(202, {"started": True})
    except Exception as e:
        return response(400, {"error": str(e)})
