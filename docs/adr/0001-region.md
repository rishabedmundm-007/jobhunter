# ADR-0001: AWS region

**Date:** 2026-09-10
**Status:** Accepted
**Deciders:** Rishab

## Context

JobHunter runs on AWS. The choice of region affects model availability (Bedrock), global CDN latency, and cost. We are initially a small team, so operational overhead should be minimal. Bedrock Claude models have wider availability in certain regions. CloudFront and ACM certificates have special handling in us-east-1.

## Decision

All workloads run in **us-east-1** (N. Virginia).

## Consequences

Positive:
- Broadest Bedrock model availability for Claude and embeddings
- CloudFront and ACM certs work natively without extra steps
- No special routing or multi-region complexity in Phase 0–1
- Simple cost accounting

Negative:
- Latency for users outside North America (not a blocker for initial users in Dallas/Plano)
- No geographic redundancy

Neutral:
- All pricing is the same across US commercial regions

## Alternatives considered

- **us-west-2 (Oregon):** Slightly cheaper compute, but Bedrock availability is identical; not chosen
- **Multi-region from the start:** Adds complexity; defer to Phase 5 if users demand it

## Related decisions

None yet.
