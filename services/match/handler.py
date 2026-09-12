"""Score DISCOVERED jobs against the user's resume/preferences, then pick a
capped, backlog-aware shortlist to send to tailoring.

Hard filters run first and are pure text heuristics (source APIs/scrapes don't
give us clean structured work-mode/sponsorship fields), so a job only pays for an
embedding call once it survives them.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from shared.bedrock import embed_text, DEFAULT_MATCH_THRESHOLD
from shared.ddb import get_profile, get_jobs, update_job, get_shortlisted_jobs_missing_resume
from shared.broadcast import broadcast_to_user

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TAILOR_TOP_N = int(os.environ.get("TAILOR_TOP_N", "5"))

NO_SPONSORSHIP_PHRASES = [
    "no sponsorship",
    "not able to sponsor",
    "unable to sponsor",
    "without sponsorship",
    "must be authorized to work",
]
ONSITE_ONLY_PHRASES = ["on-site only", "onsite only", "in office only", "no remote"]


def _hard_fail_reason(job: Dict, prefs: Dict) -> Optional[str]:
    text = f"{job.get('title', '')} {job.get('description', '')}".lower()

    if prefs.get("sponsorship_status") == "needs_h1b" and any(
        p in text for p in NO_SPONSORSHIP_PHRASES
    ):
        return "Posting indicates no visa sponsorship, but you need sponsorship."

    work_modes = set(prefs.get("work_modes", []))
    if work_modes == {"remote"} and any(p in text for p in ONSITE_ONLY_PHRASES):
        return "Posting requires on-site work; you're only open to remote."

    return None


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    user_sub = event["user_sub"]
    profile = get_profile(user_sub) or {}
    # DynamoDB always returns numbers as Decimal, never float (the read-side
    # mirror of shared.ddb._dynamo_safe on the write side) — the freshly
    # computed per-job embedding below is a plain float list from Bedrock's
    # JSON response, and Python refuses to multiply float * Decimal.
    raw_profile_embedding = profile.get("profile_embedding")
    profile_embedding = [float(x) for x in raw_profile_embedding] if raw_profile_embedding else None
    score_threshold = float(profile.get("match_threshold", DEFAULT_MATCH_THRESHOLD))
    prefs = {
        "sponsorship_status": profile.get("sponsorship_status"),
        "work_modes": profile.get("work_modes", []),
    }

    discovered = get_jobs(user_sub, state="DISCOVERED", limit=200)
    broadcast_to_user(
        user_sub,
        {
            "type": "pipeline:progress",
            "payload": {"stage": "match", "status": "started", "count": len(discovered)},
        },
    )
    shortlisted_count = 0
    filtered_out_count = 0

    for job in discovered:
        job_id = job["SK"].split("#", 1)[1]
        now = datetime.now(timezone.utc).isoformat()

        hard_fail = _hard_fail_reason(job, prefs)
        if hard_fail:
            update_job(
                user_sub,
                job_id,
                {
                    "state": "FILTERED_OUT",
                    "reasons": [hard_fail],
                    "updated_at": now,
                    "GSI1PK": f"USER#{user_sub}#STATE#FILTERED_OUT",
                    "GSI1SK": now,
                },
            )
            filtered_out_count += 1
            continue

        if not profile_embedding:
            # Resume/preferences not fully onboarded yet — leave as DISCOVERED
            # rather than guessing a score.
            continue

        try:
            job_text = (
                f"{job.get('title', '')}\n{job.get('company', '')}\n{job.get('description', '')}"
            )
            job_embedding = embed_text(job_text)
            score = _cosine_similarity(job_embedding, profile_embedding)
        except Exception:
            logger.exception("Embedding failed for job %s", job_id)
            continue

        new_state = "SHORTLISTED" if score >= score_threshold else "FILTERED_OUT"
        reasons = [f"Match score {score:.2f} vs threshold {score_threshold:.2f}"]
        update_job(
            user_sub,
            job_id,
            {
                "state": new_state,
                "score": score,
                "reasons": reasons,
                "updated_at": now,
                "GSI1PK": f"USER#{user_sub}#STATE#{new_state}",
                "GSI1SK": now,
            },
        )
        if new_state == "SHORTLISTED":
            shortlisted_count += 1
        else:
            filtered_out_count += 1

    # Backlog-aware: pick top-N from every untailored SHORTLISTED job, not just
    # ones scored in this run, so a light run doesn't waste its tailoring budget.
    backlog = get_shortlisted_jobs_missing_resume(user_sub)
    backlog.sort(key=lambda j: j.get("score", 0), reverse=True)
    top_job_ids = [j["SK"].split("#", 1)[1] for j in backlog[:TAILOR_TOP_N]]

    broadcast_to_user(
        user_sub,
        {
            "type": "pipeline:progress",
            "payload": {
                "stage": "match",
                "status": "done",
                "shortlisted": shortlisted_count,
                "filtered_out": filtered_out_count,
            },
        },
    )

    return {
        "shortlisted_count": shortlisted_count,
        "filtered_out_count": filtered_out_count,
        "tailor_job_ids": top_job_ids,
    }
