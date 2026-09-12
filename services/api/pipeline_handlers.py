import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import boto3

from .auth import get_user_from_token
from shared.ddb import get_profile, update_profile
from shared.broadcast import broadcast_to_user
from shared.http import response

sfn = boto3.client("stepfunctions")
ENV_NAME = os.environ.get("ENV_NAME", "dev")
STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]
MANUAL_RUN_COOLDOWN = timedelta(hours=1)


def trigger_pipeline_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        profile = get_profile(user_sub) or {}

        if not profile.get("resume_key") or not profile.get("job_roles"):
            return response(
                400, {"error": "Finish uploading your resume and setting preferences first."}
            )

        last_run_at = profile.get("last_manual_run_at")
        now = datetime.now(timezone.utc)
        if last_run_at:
            elapsed = now - datetime.fromisoformat(last_run_at)
            if elapsed < MANUAL_RUN_COOLDOWN:
                retry_after = int((MANUAL_RUN_COOLDOWN - elapsed).total_seconds())
                return response(
                    429,
                    {
                        "error": "You can run a manual search once per hour.",
                        "retry_after_seconds": retry_after,
                    },
                )

        update_profile(user_sub, {"last_manual_run_at": now.isoformat()})
        sfn.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            name=f"manual-{user_sub[:8]}-{int(now.timestamp())}",
            input=json.dumps({"user_sub": user_sub}),
        )
        broadcast_to_user(user_sub, {"type": "pipeline:progress", "payload": {"stage": "started"}})
        return response(202, {"started": True})
    except Exception as e:
        return response(400, {"error": str(e)})
