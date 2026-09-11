"""LinkedIn/Indeed ingestion via direct browser automation.

This deliberately overrides ADR-0003 (see docs/adr/0003-sources-policy.md) at the
user's explicit, informed request: LinkedIn and Indeed prohibit automated access in
their Terms of Service and run active anti-bot defenses. This adapter does NOT
attempt to solve CAPTCHAs or evade bot detection (no proxy rotation, no fingerprint
spoofing) — a login challenge or unrecognized page is treated as a hard failure for
this run, recorded via INTEGRATION#<provider>.status, never retried aggressively.

Runs read-only: it discovers and describes job postings. It never submits an
application or fills any form — that stays a human, review-gated action per
ADR-0004, invoked entirely separately from this ingestion path.

Invoked per-user with {"user_sub": "..."} as the Step Functions Parallel-branch
input, same contract as ingest/api_adapters.py. Writes DISCOVERED jobs straight to
DDB and returns only a small count summary.
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

import boto3
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

from shared.ddb import (
    get_profile,
    job_id_from_source,
    upsert_discovered_job,
    update_integration,
    put_integration,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
ssm = boto3.client("ssm")
ENV_NAME = os.environ.get("ENV_NAME", "dev")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "")

MAX_PAGES = 2
MAX_DETAIL_FETCHES_PER_ROLE = 8
NAV_TIMEOUT_MS = 20000


def _session_key(user_sub: str, provider: str) -> str:
    return f"users/{user_sub}/session/{provider}.json"


def _load_session_state(user_sub: str, provider: str) -> Optional[str]:
    try:
        obj = s3.get_object(Bucket=BUCKET_NAME, Key=_session_key(user_sub, provider))
        return obj["Body"].read().decode("utf-8")
    except s3.exceptions.NoSuchKey:
        return None


def _save_session_state(user_sub: str, provider: str, storage_state_json: str) -> None:
    s3.put_object(Bucket=BUCKET_NAME, Key=_session_key(user_sub, provider), Body=storage_state_json)


def _get_credentials(user_sub: str, provider: str) -> Optional[Dict]:
    try:
        param = ssm.get_parameter(
            Name=f"/jobhunter/{ENV_NAME}/users/{user_sub}/{provider}", WithDecryption=True
        )
        return json.loads(param["Parameter"]["Value"])
    except ssm.exceptions.ParameterNotFound:
        return None


def _metro_to_location(slug: str) -> str:
    parts = slug.split("_")
    state = parts[-1].upper()
    city = " ".join(parts[:-1]).title()
    return f"{city}, {state}"


def _role_matches_title(role_keywords: str, title: str) -> bool:
    role_tokens = set(role_keywords.lower().split())
    title_tokens = set(re.findall(r"[a-z]+", title.lower()))
    return bool(role_tokens & title_tokens)


def _ensure_linkedin_session(context, page, user_sub: str) -> bool:
    """Returns True if the browser context is authenticated, False on any
    challenge/failure (never retried within this run)."""
    page.goto("https://www.linkedin.com/feed/", timeout=NAV_TIMEOUT_MS)
    if "/feed" in page.url:
        return True  # saved session cookies are still valid

    creds = _get_credentials(user_sub, "linkedin")
    if not creds:
        return False

    page.goto("https://www.linkedin.com/login", timeout=NAV_TIMEOUT_MS)
    page.fill("#username", creds["username"])
    page.fill("#password", creds["password"])
    page.click("button[type='submit']")
    try:
        page.wait_for_url(re.compile(r".*linkedin\.com/feed.*"), timeout=NAV_TIMEOUT_MS)
    except PWTimeout:
        # Checkpoint/CAPTCHA/2FA page, or a changed login DOM — treat as a hard
        # failure for this run rather than fighting through it.
        update_integration(
            user_sub,
            "linkedin",
            {
                "status": "challenge_required",
                "last_checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return False

    _save_session_state(user_sub, "linkedin", json.dumps(context.storage_state()))
    put_integration(
        user_sub,
        "linkedin",
        {"status": "valid", "last_checked_at": datetime.now(timezone.utc).isoformat()},
    )
    return True


def _scrape_linkedin(page, role_keywords: str, location: str) -> List[Dict]:
    cards: List[Dict] = []
    for pg in range(MAX_PAGES):
        url = (
            "https://www.linkedin.com/jobs/search/?"
            f"keywords={quote_plus(role_keywords)}&location={quote_plus(location)}"
            f"&f_TPR=r86400&start={pg * 25}"
        )
        page.goto(url, timeout=NAV_TIMEOUT_MS)
        page.wait_for_selector("ul.jobs-search__results-list li", timeout=NAV_TIMEOUT_MS)
        for li in page.query_selector_all("ul.jobs-search__results-list li"):
            try:
                title_el = li.query_selector(".base-search-card__title")
                company_el = li.query_selector(".base-search-card__subtitle")
                link_el = li.query_selector("a.base-card__full-link")
                if not (title_el and company_el and link_el):
                    continue
                link = link_el.get_attribute("href") or ""
                job_id_match = re.search(r"-(\d+)(?:\?|$)", link)
                if not job_id_match:
                    continue
                cards.append(
                    {
                        "external_id": job_id_match.group(1),
                        "title": title_el.inner_text().strip(),
                        "company": company_el.inner_text().strip(),
                        "link": link.split("?")[0],
                    }
                )
            except Exception:
                continue  # one bad card shouldn't sink the whole page
    return cards


def _scrape_indeed(page, role_keywords: str, location: str) -> List[Dict]:
    cards: List[Dict] = []
    for pg in range(MAX_PAGES):
        url = (
            "https://www.indeed.com/jobs?"
            f"q={quote_plus(role_keywords)}&l={quote_plus(location)}&fromage=1&start={pg * 10}"
        )
        page.goto(url, timeout=NAV_TIMEOUT_MS)
        try:
            page.wait_for_selector("div.job_seen_beacon", timeout=NAV_TIMEOUT_MS)
        except PWTimeout:
            break  # no results, or a block/interstitial page — stop, don't retry
        for card in page.query_selector_all("div.job_seen_beacon"):
            try:
                external_id = card.get_attribute("data-jk")
                title_el = card.query_selector("h2.jobTitle span")
                company_el = card.query_selector("[data-testid='company-name']")
                if not (external_id and title_el):
                    continue
                cards.append(
                    {
                        "external_id": external_id,
                        "title": title_el.inner_text().strip(),
                        "company": company_el.inner_text().strip() if company_el else "",
                        "link": f"https://www.indeed.com/viewjob?jk={external_id}",
                    }
                )
            except Exception:
                continue
    return cards


def _fetch_description(page, link: str) -> str:
    try:
        page.goto(link, timeout=NAV_TIMEOUT_MS)
        body = page.query_selector("body")
        return (body.inner_text() if body else "")[:15000]
    except Exception:
        return ""


CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    # Lambda's restricted process/seccomp model is a poor fit for Chromium's
    # default zygote-fork startup path — this is the specific combination (no
    # zygote, but NOT single-process, which breaks multi-context) that the
    # standard Chromium-on-Lambda community tooling (e.g. sparticuz/chromium)
    # converges on for this exact environment.
    "--no-zygote",
]


def _run_linkedin(p, user_sub: str, job_roles: List[str], location: str) -> Dict:
    ingested = 0
    errors: List[str] = []
    ran = False
    # A fully separate browser process per source — sharing one browser across
    # two BrowserContexts (LinkedIn's persisted session, Indeed's fresh one) hit a
    # hard, non-deterministic Chromium crash/hang in this sandbox regardless of
    # single- vs multi-process mode. Full isolation is the reliable fix.
    browser = p.chromium.launch(args=CHROMIUM_ARGS)
    try:
        saved_state = _load_session_state(user_sub, "linkedin")
        context = browser.new_context(
            storage_state=json.loads(saved_state) if saved_state else None
        )
        page = context.new_page()
        if not _ensure_linkedin_session(context, page, user_sub):
            return {"ran": False, "ingested": 0, "errors": []}
        ran = True
        for role in job_roles:
            keywords = role.replace("_", " ")
            try:
                cards = _scrape_linkedin(page, keywords, location)
                fetched = 0
                for card in cards:
                    description = ""
                    if fetched < MAX_DETAIL_FETCHES_PER_ROLE and _role_matches_title(
                        keywords, card["title"]
                    ):
                        description = _fetch_description(page, card["link"])
                        fetched += 1
                    if _upsert(user_sub, "linkedin", card, description):
                        ingested += 1
            except Exception as e:
                logger.exception("LinkedIn scrape failed for role %s", role)
                errors.append(f"linkedin/{role}: {e}")
    except Exception as e:
        logger.exception("LinkedIn session setup failed")
        errors.append(f"linkedin: {e}")
    finally:
        browser.close()
    return {"ran": ran, "ingested": ingested, "errors": errors}


def _run_indeed(p, user_sub: str, job_roles: List[str], location: str) -> Dict:
    ingested = 0
    errors: List[str] = []
    browser = p.chromium.launch(args=CHROMIUM_ARGS)
    try:
        page = browser.new_context().new_page()
        for role in job_roles:
            keywords = role.replace("_", " ")
            try:
                cards = _scrape_indeed(page, keywords, location)
                fetched = 0
                for card in cards:
                    description = ""
                    if fetched < MAX_DETAIL_FETCHES_PER_ROLE and _role_matches_title(
                        keywords, card["title"]
                    ):
                        description = _fetch_description(page, card["link"])
                        fetched += 1
                    if _upsert(user_sub, "indeed", card, description):
                        ingested += 1
            except Exception as e:
                logger.exception("Indeed scrape failed for role %s", role)
                errors.append(f"indeed/{role}: {e}")
    except Exception as e:
        logger.exception("Indeed setup failed")
        errors.append(f"indeed: {e}")
    finally:
        browser.close()
    return {"ran": True, "ingested": ingested, "errors": errors}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    user_sub = event["user_sub"]
    profile = get_profile(user_sub) or {}
    job_roles = profile.get("job_roles", [])
    location = _metro_to_location(profile.get("preferred_location", ""))

    sources_run: List[str] = []
    ingested = 0
    errors: List[str] = []

    with sync_playwright() as p:
        li_result = _run_linkedin(p, user_sub, job_roles, location)
        if li_result["ran"]:
            sources_run.append("linkedin")
        ingested += li_result["ingested"]
        errors += li_result["errors"]

        indeed_result = _run_indeed(p, user_sub, job_roles, location)
        if indeed_result["ran"]:
            sources_run.append("indeed")
        ingested += indeed_result["ingested"]
        errors += indeed_result["errors"]

    return {"sources_run": sources_run, "ingested_count": ingested, "errors": errors}


def _upsert(user_sub: str, source: str, card: Dict, description: str) -> bool:
    job_id = job_id_from_source(source, card["external_id"])
    now = datetime.now(timezone.utc).isoformat()
    return upsert_discovered_job(
        user_sub,
        job_id,
        {
            "title": card["title"],
            "company": card["company"],
            "link": card.get("link"),
            "description": description,
            "location": "",
            "source": source,
            "external_id": card["external_id"],
            "posted_at": now,  # search was already filtered to the last 24h
            "state": "DISCOVERED",
            "user_sub": user_sub,
            "created_at": now,
            "updated_at": now,
            "GSI1PK": f"USER#{user_sub}#STATE#DISCOVERED",
            "GSI1SK": now,
        },
    )
