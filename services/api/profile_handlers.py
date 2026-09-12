import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict

import boto3

from .auth import get_user_from_token
from shared.ddb import get_profile, update_profile
from shared.http import response
from shared.bedrock import embed_text, structure_resume, DEFAULT_MATCH_THRESHOLD
from shared.resume_parsing import extract_text

logger = logging.getLogger()
s3 = boto3.client("s3")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "")

# .doc (legacy binary Word format) is intentionally excluded — neither pypdf nor
# python-docx can parse it, and resume structuring/matching needs extractable text.
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024
PRESIGNED_URL_TTL_SECONDS = 3600

# Fixed option sets: the future scraping/matching module keys off these exact
# values, so preferences are validated against them rather than accepted as
# free-form text.
JOB_ROLES = {
    "software_engineer",
    "frontend_developer",
    "backend_developer",
    "fullstack_developer",
    "mobile_developer",
    "devops_engineer",
    "site_reliability_engineer",
    "cloud_engineer",
    "cloud_architect",
    "data_engineer",
    "data_scientist",
    "data_analyst",
    "machine_learning_engineer",
    "qa_engineer",
    "security_engineer",
    "systems_administrator",
    "network_engineer",
    "database_administrator",
    "business_analyst",
    "product_manager",
    "project_manager",
    "ui_ux_designer",
    "it_support",
    "engineering_manager",
}
EXPERIENCE_LEVELS = {"entry", "mid", "senior"}
EMPLOYMENT_TYPES = {"full_time", "w2", "c2c"}
WORK_MODES = {"onsite", "hybrid", "remote"}
SPONSORSHIP_STATUSES = {"citizen_or_gc", "h4_ead", "needs_h1b"}
METRO_AREAS = {
    "new_york_ny",
    "los_angeles_ca",
    "chicago_il",
    "dallas_tx",
    "houston_tx",
    "washington_dc",
    "philadelphia_pa",
    "miami_fl",
    "atlanta_ga",
    "boston_ma",
    "phoenix_az",
    "san_francisco_ca",
    "san_jose_ca",
    "detroit_mi",
    "seattle_wa",
    "minneapolis_mn",
    "san_diego_ca",
    "tampa_fl",
    "denver_co",
    "baltimore_md",
    "st_louis_mo",
    "orlando_fl",
    "charlotte_nc",
    "san_antonio_tx",
    "portland_or",
    "austin_tx",
    "pittsburgh_pa",
    "sacramento_ca",
    "las_vegas_nv",
    "cincinnati_oh",
    "kansas_city_mo",
    "columbus_oh",
    "indianapolis_in",
    "cleveland_oh",
    "nashville_tn",
    "raleigh_nc",
    "salt_lake_city_ut",
    "milwaukee_wi",
    "jacksonville_fl",
    "richmond_va",
    "memphis_tn",
    "oklahoma_city_ok",
    "hartford_ct",
    "new_orleans_la",
    "buffalo_ny",
    "albuquerque_nm",
    "tucson_az",
    "fresno_ca",
    "omaha_ne",
    "louisville_ky",
}

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _is_valid_phone(phone: str) -> bool:
    digits = re.sub(r"\D", "", phone or "")
    return len(digits) == 10 or (len(digits) == 11 and digits.startswith("1"))


def _preferences_from_profile(profile: Dict) -> Dict:
    return {
        "job_roles": profile.get("job_roles", []),
        "experience_level": profile.get("experience_level"),
        "employment_types": profile.get("employment_types", []),
        "work_modes": profile.get("work_modes", []),
        "preferred_location": profile.get("preferred_location"),
        "sponsorship_status": profile.get("sponsorship_status"),
    }


def _embedding_source_hash(resume_key: str, preferences: Dict) -> str:
    payload = json.dumps({"resume_key": resume_key, "preferences": preferences}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _recompute_embedding_if_stale(profile: Dict) -> Dict:
    """Returns a profile update dict with a fresh profile_embedding + its source
    hash, or {} if resume/preferences aren't both set yet, or the cached embedding
    is already current. Never raises — matching/scoring degrades gracefully if
    Bedrock is unavailable rather than blocking profile/resume/preference saves."""
    resume_key = profile.get("resume_key")
    if not resume_key or not profile.get("job_roles"):
        return {}
    preferences = _preferences_from_profile(profile)
    source_hash = _embedding_source_hash(resume_key, preferences)
    if profile.get("embedding_source_hash") == source_hash:
        return {}
    try:
        embedding_input = (
            (profile.get("resume_text") or "")
            + "\n\nTarget preferences: "
            + json.dumps(preferences)
        )
        embedding = embed_text(embedding_input)
        return {"profile_embedding": embedding, "embedding_source_hash": source_hash}
    except Exception:
        logger.exception("Failed to recompute profile embedding for user")
        return {}


def _profile_response(profile: Dict) -> Dict:
    resume = None
    if profile and "resume_key" in profile:
        resume = {
            "key": profile["resume_key"],
            "filename": profile.get("resume_filename"),
            "size": profile.get("resume_size"),
            "uploaded_at": profile.get("resume_uploaded_at"),
            "download_url": s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": BUCKET_NAME, "Key": profile["resume_key"]},
                ExpiresIn=PRESIGNED_URL_TTL_SECONDS,
            ),
        }
    contact = None
    if profile and "first_name" in profile:
        avatar_url = None
        if profile.get("avatar_key"):
            avatar_url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": BUCKET_NAME, "Key": profile["avatar_key"]},
                ExpiresIn=PRESIGNED_URL_TTL_SECONDS,
            )
        contact = {
            "first_name": profile.get("first_name"),
            "last_name": profile.get("last_name"),
            "email": profile.get("email"),
            "phone": profile.get("phone"),
            "avatar_url": avatar_url,
        }
    preferences = None
    if profile and "job_roles" in profile:
        preferences = {
            "job_roles": profile.get("job_roles", []),
            "experience_level": profile.get("experience_level"),
            "employment_types": profile.get("employment_types", []),
            "work_modes": profile.get("work_modes", []),
            "preferred_location": profile.get("preferred_location"),
            "sponsorship_status": profile.get("sponsorship_status"),
            "match_threshold": float(profile.get("match_threshold", DEFAULT_MATCH_THRESHOLD)),
        }
    return {
        "resume": resume,
        "contact": contact,
        "preferences": preferences,
        "latest_run": profile.get("latest_run") if profile else None,
    }


def get_profile_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        profile = get_profile(user_sub)
        return response(200, _profile_response(profile))
    except Exception as e:
        return response(400, {"error": str(e)})


def create_resume_upload_url_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        body = json.loads(event.get("body", "{}"))
        filename = body["filename"]
        content_type = body.get("content_type", "application/octet-stream")
        size = int(body.get("size", 0))

        if content_type not in ALLOWED_CONTENT_TYPES:
            return response(400, {"error": "Unsupported file type. Upload a PDF or Word document."})
        if size > MAX_UPLOAD_BYTES:
            return response(400, {"error": "File is too large. Max 10MB."})

        safe_name = filename.replace("/", "_")
        key = f"users/{user_sub}/resume/{uuid.uuid4()}-{safe_name}"
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": BUCKET_NAME, "Key": key, "ContentType": content_type},
            ExpiresIn=300,
        )
        return response(200, {"upload_url": upload_url, "key": key})
    except KeyError as e:
        return response(400, {"error": f"Missing required field: {e}"})
    except Exception as e:
        return response(400, {"error": str(e)})


def create_avatar_upload_url_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        body = json.loads(event.get("body", "{}"))
        filename = body["filename"]
        content_type = body.get("content_type", "application/octet-stream")
        size = int(body.get("size", 0))

        if content_type not in ALLOWED_AVATAR_TYPES:
            return response(
                400, {"error": "Unsupported image type. Upload a JPEG, PNG, or WebP image."}
            )
        if size > MAX_AVATAR_BYTES:
            return response(400, {"error": "Image is too large. Max 5MB."})

        safe_name = filename.replace("/", "_")
        key = f"users/{user_sub}/avatar/{uuid.uuid4()}-{safe_name}"
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": BUCKET_NAME, "Key": key, "ContentType": content_type},
            ExpiresIn=300,
        )
        return response(200, {"upload_url": upload_url, "key": key})
    except KeyError as e:
        return response(400, {"error": f"Missing required field: {e}"})
    except Exception as e:
        return response(400, {"error": str(e)})


def confirm_avatar_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        body = json.loads(event.get("body", "{}"))
        key = body["key"]

        if not key.startswith(f"users/{user_sub}/avatar/"):
            return response(403, {"error": "Forbidden"})

        profile = update_profile(user_sub, {"avatar_key": key})
        return response(200, {"contact": _profile_response(profile)["contact"]})
    except KeyError as e:
        return response(400, {"error": f"Missing required field: {e}"})
    except Exception as e:
        return response(400, {"error": str(e)})


def save_preferences_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        body = json.loads(event.get("body", "{}"))

        first_name = (body.get("first_name") or "").strip()
        last_name = (body.get("last_name") or "").strip()
        email = (body.get("email") or "").strip()
        phone = (body.get("phone") or "").strip()
        job_roles = body.get("job_roles", [])
        experience_level = body.get("experience_level")
        employment_types = body.get("employment_types", [])
        work_modes = body.get("work_modes", [])
        preferred_location = body.get("preferred_location")
        sponsorship_status = body.get("sponsorship_status")
        match_threshold = body.get("match_threshold", DEFAULT_MATCH_THRESHOLD)

        if not first_name or len(first_name) > 100:
            return response(400, {"error": "Enter a valid first name."})
        if not last_name or len(last_name) > 100:
            return response(400, {"error": "Enter a valid last name."})
        if not EMAIL_PATTERN.match(email):
            return response(400, {"error": "Enter a valid email address."})
        if not _is_valid_phone(phone):
            return response(400, {"error": "Enter a valid 10-digit phone number."})
        if not job_roles or not all(r in JOB_ROLES for r in job_roles):
            return response(400, {"error": "Select at least one valid job role."})
        if experience_level not in EXPERIENCE_LEVELS:
            return response(400, {"error": "Select a valid experience level."})
        if not employment_types or not all(t in EMPLOYMENT_TYPES for t in employment_types):
            return response(400, {"error": "Select at least one valid employment type."})
        if not work_modes or not all(m in WORK_MODES for m in work_modes):
            return response(400, {"error": "Select at least one valid work arrangement."})
        if preferred_location not in METRO_AREAS:
            return response(400, {"error": "Select a valid preferred location."})
        if sponsorship_status not in SPONSORSHIP_STATUSES:
            return response(400, {"error": "Select a valid sponsorship status."})
        if not isinstance(match_threshold, (int, float)) or not 0.0 <= match_threshold <= 1.0:
            return response(400, {"error": "Match sensitivity must be between 0 and 1."})

        profile = update_profile(
            user_sub,
            {
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": phone,
                "job_roles": job_roles,
                "experience_level": experience_level,
                "employment_types": employment_types,
                "work_modes": work_modes,
                "preferred_location": preferred_location,
                "sponsorship_status": sponsorship_status,
                "match_threshold": match_threshold,
                "preferences_updated_at": datetime.utcnow().isoformat(),
            },
        )
        embedding_updates = _recompute_embedding_if_stale(profile)
        if embedding_updates:
            profile = update_profile(user_sub, embedding_updates)
        profile_out = _profile_response(profile)
        return response(
            200, {"contact": profile_out["contact"], "preferences": profile_out["preferences"]}
        )
    except Exception as e:
        return response(400, {"error": str(e)})


def confirm_resume_handler(event: Dict[str, Any], context: Any) -> Dict:
    try:
        user_sub = get_user_from_token(event)
        body = json.loads(event.get("body", "{}"))
        key = body["key"]
        filename = body["filename"]
        size = int(body.get("size", 0))

        if not key.startswith(f"users/{user_sub}/resume/"):
            return response(403, {"error": "Forbidden"})

        updates = {
            "resume_key": key,
            "resume_filename": filename,
            "resume_size": size,
            "resume_uploaded_at": datetime.utcnow().isoformat(),
        }
        # Text extraction + structuring feed the matching/tailoring pipeline, but
        # a parsing hiccup (scanned PDF with no text layer, Bedrock hiccup) should
        # never block the user's resume upload from being confirmed.
        try:
            obj = s3.get_object(Bucket=BUCKET_NAME, Key=key)
            file_bytes = obj["Body"].read()
            resume_text = extract_text(file_bytes, obj["ContentType"])
            updates["resume_text"] = resume_text[:20000]
            updates["base_resume_json"] = structure_resume(resume_text)
        except Exception:
            logger.exception("Resume text extraction/structuring failed for upload %s", key)

        profile = update_profile(user_sub, updates)
        embedding_updates = _recompute_embedding_if_stale(profile)
        if embedding_updates:
            profile = update_profile(user_sub, embedding_updates)
        return response(
            200,
            {"resume": _profile_response(profile)["resume"]},
        )
    except KeyError as e:
        return response(400, {"error": f"Missing required field: {e}"})
    except Exception as e:
        return response(400, {"error": str(e)})
