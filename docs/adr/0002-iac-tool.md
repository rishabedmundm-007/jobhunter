# ADR-0002: Infrastructure as Code tool

**Date:** 2026-09-10
**Status:** Accepted
**Deciders:** Rishab

## Context

JobHunter infra is defined in code. Options: AWS CDK, Terraform, CloudFormation YAML, SAM. We are a Python-first team (services, Lambdas, local dev). CDK integrates Python natively. Terraform requires HCL. YAML and SAM are lower-level.

## Decision

Use **AWS CDK v2 in Python**.

## Consequences

Positive:
- One language across infra and services (Python)
- Powerful abstractions and composability
- Type hints via Constructs
- Built-in diff and deploy
- Excellent Lambda construct support

Negative:
- Harder to switch later (Terraform is the escape hatch)
- Less portable (AWS-specific)

Neutral:
- Moderate learning curve (less than Terraform's HCL)

## Alternatives considered

- **Terraform:** Language agnostic, multi-cloud, but requires HCL; defer to Phase 5 if portability becomes a requirement
- **CloudFormation YAML:** Lower level, verbose; only for manual changes
- **SAM:** Thin wrapper over CloudFormation; less powerful for non-Lambda constructs

## Related decisions

None yet.
