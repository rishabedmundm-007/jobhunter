"""Ingestion from legitimate, documented public job-board APIs (ADR-0003 sources).

Invoked per-user with {"user_sub": "..."} as the Step Functions Parallel-branch
input. Writes DISCOVERED jobs straight to DDB and returns only a small count
summary — no job payloads flow back through the state machine.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import boto3
import httpx

from shared.ddb import get_profile, job_id_from_source, upsert_discovered_job

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ssm = boto3.client("ssm")
ENV_NAME = os.environ.get("ENV_NAME", "dev")
LOOKBACK_HOURS = 24
HTTP_TIMEOUT = 15.0


def _ssm_json(name: str) -> Optional[Dict]:
    try:
        param = ssm.get_parameter(Name=name, WithDecryption=True)
        return json.loads(param["Parameter"]["Value"])
    except ssm.exceptions.ParameterNotFound:
        return None


def _metro_to_location(slug: str) -> str:
    parts = slug.split("_")
    state = parts[-1].upper()
    city = " ".join(parts[:-1]).title()
    return f"{city}, {state}"


def _role_to_keywords(slug: str) -> str:
    return slug.replace("_", " ")


def _is_recent(posted_at: Optional[str], cutoff: datetime) -> bool:
    if not posted_at:
        return True  # source didn't give us a date — don't discard, let matching handle it
    try:
        dt = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt >= cutoff
    except ValueError:
        return True


def _fetch_adzuna(keywords: str, location: str) -> List[Dict]:
    creds = _ssm_json(f"/jobhunter/{ENV_NAME}/adzuna")
    if not creds:
        return []
    resp = httpx.get(
        "https://api.adzuna.com/v1/api/jobs/us/search/1",
        params={
            "app_id": creds["app_id"],
            "app_key": creds["app_key"],
            "what": keywords,
            "where": location,
            "max_days_old": 1,
            "content-type": "application/json",
        },
        timeout=HTTP_TIMEOUT,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])
    return [
        {
            "external_id": str(r["id"]),
            "title": r.get("title", ""),
            "company": (r.get("company") or {}).get("display_name", ""),
            "location": (r.get("location") or {}).get("display_name", ""),
            "description": r.get("description", ""),
            "link": r.get("redirect_url", ""),
            "posted_at": r.get("created"),
        }
        for r in results
    ]


def _fetch_usajobs(keywords: str, location: str) -> List[Dict]:
    creds = _ssm_json(f"/jobhunter/{ENV_NAME}/usajobs")
    if not creds:
        return []
    resp = httpx.get(
        "https://data.usajobs.gov/api/search",
        params={"Keyword": keywords, "LocationName": location, "DatePosted": 1},
        headers={
            "Host": "data.usajobs.gov",
            "User-Agent": creds["email"],
            "Authorization-Key": creds["api_key"],
        },
        timeout=HTTP_TIMEOUT,
    )
    resp.raise_for_status()
    items = resp.json().get("SearchResult", {}).get("SearchResultItems", [])
    out = []
    for item in items:
        d = item.get("MatchedObjectDescriptor", {})
        out.append(
            {
                "external_id": d.get("PositionID", ""),
                "title": d.get("PositionTitle", ""),
                "company": d.get("OrganizationName", ""),
                "location": d.get("PositionLocationDisplay", ""),
                "description": (d.get("UserArea", {}).get("Details", {}) or {}).get(
                    "JobSummary", ""
                ),
                "link": d.get("PositionURI", ""),
                "posted_at": d.get("PublicationStartDate"),
            }
        )
    return out


def _fetch_remotive(keywords: str) -> List[Dict]:
    resp = httpx.get(
        "https://remotive.com/api/remote-jobs",
        params={"search": keywords},
        timeout=HTTP_TIMEOUT,
    )
    resp.raise_for_status()
    jobs = resp.json().get("jobs", [])
    return [
        {
            "external_id": str(j["id"]),
            "title": j.get("title", ""),
            "company": j.get("company_name", ""),
            "location": j.get("candidate_required_location", ""),
            "description": j.get("description", ""),
            "link": j.get("url", ""),
            "posted_at": j.get("publication_date"),
        }
        for j in jobs
    ]


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    user_sub = event["user_sub"]
    profile = get_profile(user_sub) or {}
    job_roles = profile.get("job_roles", [])
    location = _metro_to_location(profile.get("preferred_location", ""))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)

    sources_run: List[str] = []
    ingested = 0
    errors: List[str] = []

    fetchers = {
        "adzuna": lambda kw: _fetch_adzuna(kw, location),
        "usajobs": lambda kw: _fetch_usajobs(kw, location),
        "remotive": lambda kw: _fetch_remotive(kw),
    }

    for role in job_roles:
        keywords = _role_to_keywords(role)
        for source, fetch in fetchers.items():
            try:
                raw_jobs = fetch(keywords)
            except Exception as e:
                logger.exception("Adapter %s failed for role %s", source, role)
                errors.append(f"{source}: {e}")
                continue
            if source not in sources_run:
                sources_run.append(source)
            for raw in raw_jobs:
                if not raw.get("external_id") or not _is_recent(raw.get("posted_at"), cutoff):
                    continue
                job_id = job_id_from_source(source, raw["external_id"])
                now = datetime.now(timezone.utc).isoformat()
                inserted = upsert_discovered_job(
                    user_sub,
                    job_id,
                    {
                        "title": raw["title"],
                        "company": raw["company"],
                        "link": raw.get("link"),
                        "description": raw.get("description", ""),
                        "location": raw.get("location", ""),
                        "source": source,
                        "external_id": raw["external_id"],
                        "posted_at": raw.get("posted_at"),
                        "state": "DISCOVERED",
                        "user_sub": user_sub,
                        "created_at": now,
                        "updated_at": now,
                        "GSI1PK": f"USER#{user_sub}#STATE#DISCOVERED",
                        "GSI1SK": now,
                    },
                )
                if inserted:
                    ingested += 1

    return {"sources_run": sources_run, "ingested_count": ingested, "errors": errors}
