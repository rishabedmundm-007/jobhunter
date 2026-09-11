# ADR-0003: Job ingestion sources policy

**Date:** 2026-09-10
**Status:** Accepted (reaffirmed after a same-day override attempt — see below)
**Deciders:** Rishab

## Context

JobHunter ingests jobs from the market. Sources vary in accessibility: public APIs are safe and legal, scraping violates ToS and risks account bans. Some sources (LinkedIn, Indeed) explicitly forbid bots. Other sources (Greenhouse, Lever, Adzuna) have documented APIs.

## Decision

Ingest **only** from sources with:
1. Documented public APIs (Greenhouse, Lever, Ashby, Adzuna, USAJOBS, Remotive)
2. Public RSS feeds (company career pages)
3. User's own inbox (C2C emails, vendor blasts)

**Never** scrape LinkedIn, Indeed, or any site with anti-bot mechanisms.

## Consequences

Positive:
- No risk of account bans or legal issues
- Stable, maintainable integrations
- Respects ToS and robot.txt
- User's own email is the richest C2C source and fully legal

Negative:
- Missing some job boards (Indeed, LinkedIn)
- Need to maintain per-ATS adapters

Neutral:
- Coverage is still wide (thousands of companies post on Greenhouse/Lever alone)

## Alternatives considered

- **Scrape everything:** Violates ToS; gets accounts banned; rejected
- **API aggregators only:** Narrower source coverage; not chosen
- **Manual entry:** Users can paste a job URL and we parse it as a fallback

## Override attempt and reversal (2026-09-10 to 2026-09-11)

When the ingestion/matching/tailoring module was implemented, the user was asked
directly whether to follow this ADR or override it, was explicitly warned of the
ToS-violation, account-suspension, and technical-fragility risks, and chose to
override it: LinkedIn and Indeed were ingested via direct browser automation
(Playwright, the user's own login) alongside the originally-approved sources.

Guardrails kept even under the override: no CAPTCHA-solving, proxy rotation, or
fingerprint spoofing — a login challenge or unrecognized page was treated as a
hard failure for that run, never fought through; read-only (discover/describe
only, never submit an application, per ADR-0004 regardless of source).

**Within the first real test runs, both sources hit exactly the failure mode
this ADR predicted** — confirmed with captured screenshots, not assumed:
- LinkedIn presented a live Google reCAPTCHA on login from the Lambda's IP.
- Indeed returned a Cloudflare "Request Blocked" page (Ray ID + IP logged) on
  every request, not genuine zero-result searches.

The user decided to accept this outcome rather than pursue evasion (proxy
rotation, CAPTCHA-solving, or a manual cookie handoff), which this project
was never going to build regardless. **The browser-automation adapter and all
supporting code (Connected Accounts credential storage, the container Lambda,
the DynamoDB `INTEGRATION#` items) have been fully removed.** The original
decision — API/RSS/inbox sources only — stands as accepted, now validated by
a real, not just theoretical, failure.

## Related decisions

None yet.
