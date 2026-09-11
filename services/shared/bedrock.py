import json
import os
from typing import Any, Dict, List

import boto3

bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

EMBEDDING_MODEL_ID = os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
EMBEDDING_DIMENSIONS = int(os.environ.get("EMBEDDING_DIMENSIONS", "512"))
HAIKU_MODEL_ID = os.environ.get(
    # Claude Haiku 4.5 requires invocation via a cross-region inference profile,
    # not the bare foundation-model ID — verified against the account's actual
    # Bedrock access at implementation time.
    "TAILOR_MODEL_ID",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
)

# Shared JSON shape for both the parsed base resume and any tailored rewrite of it,
# so rendering to .docx never needs a translation layer between the two.
RESUME_SCHEMA_DESCRIPTION = """{
  "contact": {"name": string, "email": string, "phone": string, "location": string},
  "summary": string,
  "skills": [string, ...],
  "experience": [
    {"company": string, "title": string, "location": string, "start_date": string,
     "end_date": string, "bullets": [string, ...]}
  ],
  "education": [
    {"school": string, "degree": string, "field": string, "graduation_date": string}
  ],
  "certifications": [string, ...]
}"""


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
    resp = bedrock.invoke_model(modelId=HAIKU_MODEL_ID, body=body)
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
    prompt_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "prompts", "resume-structure.md"
    )
    with open(prompt_path) as f:
        system_prompt = f.read()
    raw = _invoke_claude(system_prompt, resume_text[:20000])
    return _extract_json(raw)


def tailor_resume(
    base_resume_json: Dict[str, Any], job_description: str, preferences: Dict[str, Any]
) -> Dict[str, Any]:
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "..", "prompts", "resume-tailor.md")
    with open(prompt_path) as f:
        system_prompt = f.read()
    user_message = json.dumps(
        {
            "base_resume": base_resume_json,
            "job_description": job_description[:15000],
            "target_profile": preferences,
        }
    )
    raw = _invoke_claude(system_prompt, user_message)
    return _extract_json(raw)
