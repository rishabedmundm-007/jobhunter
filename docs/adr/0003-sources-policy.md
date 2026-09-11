# ADR-0003: Job ingestion sources policy

**Date:** 2026-09-10
**Status:** Superseded by explicit override (see below)
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

## Related decisions

None yet.

## Override (2026-09-10, same day)

When the ingestion/matching/tailoring module was implemented, the user was asked
directly whether to follow this ADR or override it, was explicitly warned of the
ToS-violation, account-suspension, and technical-fragility risks, and chose to
override it **twice** after that warning: LinkedIn and Indeed are ingested via
direct browser automation (Playwright, the user's own login) alongside the
originally-approved sources, which remain in place unchanged.

Guardrails kept from the original decision, even under the override:
- No CAPTCHA-solving, proxy rotation, or fingerprint spoofing — a login
  challenge or unrecognized page is a hard failure for that run
  (`INTEGRATION#<provider>.status = "challenge_required"`), never fought through
  or retried aggressively.
- Read-only: this adapter discovers and describes postings; it never submits an
  application or fills a form (see ADR-0004 — that stays human-gated regardless
  of source).

See `services/ingest/browser_adapter/` for the implementation and its inline
disclosure of this override.
