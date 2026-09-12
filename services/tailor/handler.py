"""Generate one ATS-clean, job-specific resume for a shortlisted job.

Invoked once per job ID from the pipeline's Map state. Broadcasts a
"pipeline:progress" update per job (for the on-demand live-run view) in
addition to the pipeline's final batched "pipeline:completed" event from
finalize.py — a start/done pair per job is small enough (top-N capped) not to
flood the socket the way a per-job "job:updated" would.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict

import boto3

from shared.bedrock import HAIKU_MODEL_ID, tailor_resume
from shared.ddb import get_job, get_profile, put_resume_version, update_job
from shared.docx_render import render_resume_docx
from shared.broadcast import broadcast_to_user

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "")
PROMPT_VERSION = "resume-tailor-v1"


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    user_sub = event["user_sub"]
    job_id = event["job_id"]

    job = get_job(user_sub, job_id)
    profile = get_profile(user_sub) or {}
    base_resume_json = profile.get("base_resume_json")
    if not job or not base_resume_json:
        return {"job_id": job_id, "status": "skipped", "reason": "missing job or base resume"}

    broadcast_to_user(
        user_sub,
        {
            "type": "pipeline:progress",
            "payload": {
                "stage": "tailor",
                "status": "started",
                "job_title": job.get("title"),
                "company": job.get("company"),
            },
        },
    )

    preferences = {
        "job_roles": profile.get("job_roles", []),
        "experience_level": profile.get("experience_level"),
        "employment_types": profile.get("employment_types", []),
        "work_modes": profile.get("work_modes", []),
    }

    try:
        tailored = tailor_resume(base_resume_json, job.get("description", ""), preferences)
    except Exception:
        logger.exception("Tailoring failed for job %s", job_id)
        broadcast_to_user(
            user_sub,
            {
                "type": "pipeline:progress",
                "payload": {"stage": "tailor", "status": "error", "job_title": job.get("title")},
            },
        )
        return {"job_id": job_id, "status": "error"}

    ats_report = tailored.pop("ats_report", {})
    docx_bytes = render_resume_docx(tailored)

    s3_key = f"users/{user_sub}/tailored/{job_id}/resume.docx"
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=docx_bytes,
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    now = datetime.now(timezone.utc).isoformat()
    put_resume_version(
        user_sub,
        job_id,
        {
            "s3_key": s3_key,
            "model_id": HAIKU_MODEL_ID,
            "prompt_version": PROMPT_VERSION,
            "ats_report": ats_report,
            "created_at": now,
        },
    )
    update_job(
        user_sub,
        job_id,
        {
            "state": "RESUME_READY",
            "tailored_resume_key": s3_key,
            "tailored_at": now,
            "updated_at": now,
            "GSI1PK": f"USER#{user_sub}#STATE#RESUME_READY",
            "GSI1SK": now,
        },
    )
    broadcast_to_user(
        user_sub,
        {
            "type": "pipeline:progress",
            "payload": {
                "stage": "tailor",
                "status": "done",
                "job_title": job.get("title"),
                "company": job.get("company"),
            },
        },
    )
    return {"job_id": job_id, "status": "tailored"}
