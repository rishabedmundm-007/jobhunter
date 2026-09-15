import json
import os
from typing import Any, Dict, List

import boto3

bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

EMBEDDING_MODEL_ID = os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
EMBEDDING_DIMENSIONS = int(os.environ.get("EMBEDDING_DIMENSIONS", "512"))

# Cosine similarity between a full resume embedding and a raw job-description
# embedding runs lower in practice than the blueprint's original 0.72 guess —
# real test data topped out around 0.52 for a genuine title-exact match, with
# clear noise (irrelevant roles) sitting at 0.10-0.30. 0.40 was chosen from
# that real distribution, not decided in the abstract; it's a floor a user
# can override per-profile (see match_threshold on PROFILE), not a hardcoded
# ceiling.
DEFAULT_MATCH_THRESHOLD = 0.40
TAILOR_MODEL_ID = os.environ.get(
    # Opus 5 is the intended upgrade (better resume-writing quality than
    # Haiku 4.5 for a trivial per-resume cost difference) but this AWS
    # account hasn't been granted Bedrock model access for it yet — every
    # InvokeModel call returns AccessDeniedException until that's enabled in
    # the console (Bedrock > Model access), so this stays on the
    # confirmed-working model until that's done. Flip this the moment access
    # is granted.
    "TAILOR_MODEL_ID",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
)

# Both structuring and tailoring need headroom for a dense, multi-job resume
# with categorized skills and inline bold emphasis — 4096 risked truncating a
# 2-page resume's worth of bullets mid-JSON.
RESUME_MAX_TOKENS = 8192


def embed_text(text: str) -> List[float]:
    body = json.dumps(
        {
            "inputText": text[:50000],
            "dimensions": EMBEDDING_DIMENSIONS,
            "normalize": True,
        }
    )
    resp = bedrock.invoke_model(modelId=EMBEDDING_MODEL_ID, body=body)
    payload = json.loads(resp["body"].read())
    return payload["embedding"]


def _invoke_claude(system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        }
    )
    resp = bedrock.invoke_model(modelId=TAILOR_MODEL_ID, body=body)
    payload = json.loads(resp["body"].read())
    return payload["content"][0]["text"]


def _extract_json(text: str) -> Dict[str, Any]:
    # Models occasionally wrap JSON in prose or a fenced code block despite
    # instructions — take the outermost {...} span rather than failing outright.
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in model output: {text[:200]!r}")
    return json.loads(text[start : end + 1])


def structure_resume(resume_text: str) -> Dict[str, Any]:
    # prompts/ lives under services/ (not the repo root) specifically so it's
    # included in the Lambda deployment package — CDK bundles the whole
    # services/ directory, and a sibling-of-services/ directory silently
    # doesn't ship, which is exactly what broke this in production before
    # (worked when run locally against the full repo checkout, 404'd in
    # every deployed Lambda).
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "resume-structure.md")
    with open(prompt_path) as f:
        system_prompt = f.read()
    raw = _invoke_claude(system_prompt, resume_text[:20000], max_tokens=RESUME_MAX_TOKENS)
    return _extract_json(raw)


def tailor_resume(
    base_resume_json: Dict[str, Any], job_description: str, preferences: Dict[str, Any]
) -> Dict[str, Any]:
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "resume-tailor.md")
    with open(prompt_path) as f:
        system_prompt = f.read()
    user_message = json.dumps(
        {
            "base_resume": base_resume_json,
            "job_description": job_description[:15000],
            "target_profile": preferences,
        }
    )
    raw = _invoke_claude(system_prompt, user_message, max_tokens=RESUME_MAX_TOKENS)
    return _extract_json(raw)
