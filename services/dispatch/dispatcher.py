"""Fans the scheduled pipeline run out to one Step Functions Express execution
per user who's completed onboarding (resume + preferences set)."""

import json
import logging
import os
import uuid
from typing import Any, Dict

import boto3

from shared.ddb import list_active_profiles

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sfn = boto3.client("stepfunctions")
STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    profiles = list_active_profiles()
    started = 0
    for profile in profiles:
        user_sub = profile["PK"].split("#", 1)[1]
        try:
            sfn.start_execution(
                stateMachineArn=STATE_MACHINE_ARN,
                name=f"{user_sub[:8]}-{uuid.uuid4().hex[:8]}",
                input=json.dumps({"user_sub": user_sub}),
            )
            started += 1
        except Exception:
            logger.exception("Failed to start pipeline execution for a user")
    return {"users_dispatched": started}
