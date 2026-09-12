"""Ingestion from legitimate, documented public job-board APIs (ADR-0003 sources).

Invoked per-user with {"user_sub": "..."} as the Step Functions Parallel-branch
input. Writes DISCOVERED jobs straight to DDB and returns only a small count
summary — no job payloads flow back through the state machine.
"""

import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import boto3
import httpx

from shared.ddb import (
    get_profile,
    job_id_from_source,
    content_fingerprint,
    claim_content_fingerprint,
    upsert_discovered_job,
)
from shared.broadcast import broadcast_to_user

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ssm = boto3.client("ssm")
ENV_NAME = os.environ.get("ENV_NAME", "dev")
LOOKBACK_HOURS = 24 * 10  # 10 days — a strict 24h window left almost nothing to find
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


def _fetch_remoteok_raw() -> List[Dict]:
    # No server-side search/filter support — the API just returns its recent
    # catalog (a few hundred postings); the first element is a legal notice,
    # not a job. Fetched once per run (see the closure cache in lambda_handler
    # below) and filtered client-side per role, instead of once per role.
    resp = httpx.get(
        "https://remoteok.com/api",
        headers={"User-Agent": "Jobsperch/1.0 (+https://jobsperch.com)"},
        timeout=HTTP_TIMEOUT,
    )
    resp.raise_for_status()
    return [d for d in resp.json() if isinstance(d, dict) and d.get("id")]


def _filter_remoteok(raw_jobs: List[Dict], keywords: str) -> List[Dict]:
    kw_tokens = set(keywords.lower().split())
    out = []
    for j in raw_jobs:
        haystack = f"{j.get('position', '')} {' '.join(j.get('tags') or [])}"
        if not (kw_tokens & set(re.findall(r"[a-z0-9+#]+", haystack.lower()))):
            continue
        out.append(
            {
                "external_id": str(j.get("id")),
                "title": j.get("position", ""),
                "company": j.get("company", ""),
                "location": j.get("location") or "Remote",
                "description": j.get("description", ""),
                "link": j.get("url", ""),
                "posted_at": j.get("date"),
            }
        )
    return out


def _fetch_jsearch(keywords: str, location: str) -> List[Dict]:
    creds = _ssm_json(f"/jobhunter/{ENV_NAME}/jsearch")
    if not creds:
        return []
    resp = httpx.get(
        # "/search" 404s on this account's plan (RapidAPI proxy rejects it before
        # reaching JSearch's backend) — "/search-v2" is the current live
        # endpoint, confirmed directly against the account's own RapidAPI
        # console, with a nested {"data": {"jobs": [...]}} shape rather than
        # v1's flat {"data": [...]}.
        "https://jsearch.p.rapidapi.com/search-v2",
        params={
            "query": f"{keywords} in {location}",
            "country": "us",
            "date_posted": "today",
            "num_pages": "1",
        },
        headers={
            "X-RapidAPI-Key": creds["api_key"],
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
        timeout=HTTP_TIMEOUT,
    )
    resp.raise_for_status()
    results = resp.json().get("data", {}).get("jobs", [])
    out = []
    for r in results:
        out.append(
            {
                "external_id": r.get("job_id", ""),
                "title": r.get("job_title", ""),
                "company": r.get("employer_name", ""),
                "location": r.get("job_location", ""),
                "description": r.get("job_description", ""),
                "link": r.get("job_apply_link", ""),
                "posted_at": r.get("job_posted_at_datetime_utc"),
            }
        )
    return out


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    user_sub = event["user_sub"]
    profile = get_profile(user_sub) or {}
    job_roles = profile.get("job_roles", [])
    location = _metro_to_location(profile.get("preferred_location", ""))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)

    sources_run: List[str] = []
    ingested = 0
    errors: List[str] = []

    remoteok_cache: Dict[str, Optional[List[Dict]]] = {"jobs": None}

    def fetch_remoteok(kw: str) -> List[Dict]:
        if remoteok_cache["jobs"] is None:
            remoteok_cache["jobs"] = _fetch_remoteok_raw()
        return _filter_remoteok(remoteok_cache["jobs"], kw)

    fetchers = {
        "adzuna": lambda kw: _fetch_adzuna(kw, location),
        "usajobs": lambda kw: _fetch_usajobs(kw, location),
        "remotive": lambda kw: _fetch_remotive(kw),
        "remoteok": fetch_remoteok,
        "jsearch": lambda kw: _fetch_jsearch(kw, location),
    }

    # Sources outer, roles inner (rather than the reverse) so each source can
    # broadcast one "checking"/"found" pair covering all of the user's roles,
    # instead of one per role — meaningful live updates without being chatty.
    for source, fetch in fetchers.items():
        broadcast_to_user(
            user_sub,
            {
                "type": "pipeline:progress",
                "payload": {"stage": "ingest", "source": source, "status": "checking"},
            },
        )
        source_found = 0
        for role in job_roles:
            keywords = _role_to_keywords(role)
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
                # Cross-source duplicate guard: skip before even attempting the
                # per-source insert if this same title+company has already
                # surfaced from any source, in any state (applied, skipped,
                # etc.) — never let a job the user already dealt with resurface
                # under a different source's id.
                if not claim_content_fingerprint(
                    user_sub, content_fingerprint(raw["title"], raw["company"])
                ):
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
                    source_found += 1
        broadcast_to_user(
            user_sub,
            {
                "type": "pipeline:progress",
                "payload": {
                    "stage": "ingest",
                    "source": source,
                    "status": "done",
                    "found": source_found,
                },
            },
        )

    return {"sources_run": sources_run, "ingested_count": ingested, "errors": errors}
