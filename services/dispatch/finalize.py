"""Final state of the per-user pipeline execution: writes the audit-log RUN item,
denormalizes a summary onto PROFILE for the dashboard's "last run" stat, and sends
one batched WebSocket event instead of a burst of per-job messages."""

from datetime import datetime, timezone
from typing import Any, Dict

from shared.ddb import put_run, update_profile
from shared.broadcast import broadcast_to_user


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    user_sub = event["user_sub"]
    ingest_results = event.get("ingest_results", [])
    match_result = event.get("match_result", {})
    tailor_results = event.get("tailor_results", [])

    ingested_count = sum(r.get("ingested_count", 0) for r in ingest_results)
    sources_run = sorted({s for r in ingest_results for s in r.get("sources_run", [])})
    errors = [e for r in ingest_results for e in r.get("errors", [])]
    tailored_count = sum(1 for r in tailor_results if r.get("status") == "tailored")

    now = datetime.now(timezone.utc).isoformat()
    run_summary = {
        "sources_run": sources_run,
        "ingested_count": ingested_count,
        "shortlisted_count": match_result.get("shortlisted_count", 0),
        "filtered_out_count": match_result.get("filtered_out_count", 0),
        "tailored_count": tailored_count,
        "errors": errors,
        "run_at": now,
    }

    put_run(user_sub, now, run_summary)
    update_profile(user_sub, {"latest_run": run_summary})
    broadcast_to_user(user_sub, {"type": "pipeline:completed", "payload": run_summary})

    return run_summary
