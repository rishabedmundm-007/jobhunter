# ADR-0003: Job ingestion sources policy

**Date:** 2026-09-10
**Status:** Accepted
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
