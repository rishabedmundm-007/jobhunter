# Project docs

Pre-build documentation pack for the automated job search + application tracking platform. Read in order.

| # | Document | Read this when |
|---|---|---|
| 01 | [Architecture blueprint](01-architecture-blueprint.md) | You want the whole system in one place: two key design decisions, diagrams, AWS service map, data model, cost model, phases |
| 02 | [Module breakdown](02-module-breakdown.md) | You are splitting work between the two of you, or onboarding a contributor to one part |
| 03 | [Prerequisites checklist](03-prerequisites-checklist.md) | Before touching the AWS console or creating the repo |

Diagrams are Mermaid and render natively on GitHub.

## Conventions

- Architectural decisions go in `docs/adr/` as `NNNN-short-title.md` using the template there.
- Every module directory has its own `README.md` (what / run locally / test / deploy).
- These three documents are living: update them in the same PR that changes the thing they describe.
