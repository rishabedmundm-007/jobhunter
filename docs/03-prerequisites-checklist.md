# 03 — Prerequisites Checklist

Work through this top to bottom before Phase 0. Tick boxes in the PR that closes "Foundations".

---

## A. AWS account

- [ ] **Dedicated account** for this project (not one holding anything you care about). Create it inside an AWS Organization if you already have one; otherwise a fresh account is fine and can be moved later.
- [ ] Root user: hardware or authenticator MFA enabled; root access keys **deleted**; root email is a group alias you both can read.
- [ ] **IAM Identity Center** (SSO) enabled with two users (you + friend), permission set `AdministratorAccess` for `dev` only. No IAM users with long-lived access keys.
- [ ] **Region decision:** `us-east-1` (Bedrock model availability is widest, CloudFront/ACM certs must live there anyway). Record it in an ADR.
- [ ] **Bedrock model access** requested and approved for: Claude 3.5 Haiku (or current Haiku), Claude Sonnet (current), Titan Text Embeddings v2. Approval can take hours.
- [ ] **AWS Budgets:** three budgets — $10 (email), $25 (email + SNS), $50 (email + SNS). Also a CloudWatch billing alarm as a second signal.
- [ ] **Cost allocation tags** activated: `project`, `env`, `module`. CDK applies them to every resource.
- [ ] Service quotas checked: Lambda concurrency (default 1,000 is fine), API Gateway WebSocket connections, SES sandbox (request production access only if you send email).
- [ ] CloudTrail enabled (management events, free tier) → S3 bucket with 90-day lifecycle.
- [ ] Optional: AWS credits applied, if you have any. Free tier is 12 months for S3/API Gateway/CloudFront; Lambda/DynamoDB/Cognito are always-free within limits.

## B. GitHub repository

- [ ] Private repo created (name TBD is fine — rename later; GitHub redirects).
- [ ] Branch protection on `main`: PR required, 1 approval, CI must pass, no force push.
- [ ] `CODEOWNERS`: `infra/` + `services/` → backend owner, `web/` + `docs/` → frontend owner, `docs/api/openapi.yaml` → both.
- [ ] **OIDC trust** between GitHub Actions and an AWS deploy role (`GitHubDeployRole`) scoped to this repo — no AWS secrets stored in GitHub.
- [ ] Repo secrets/variables: `AWS_ACCOUNT_ID`, `AWS_REGION`, `DEPLOY_ROLE_ARN`. Nothing else.
- [ ] Issue templates: bug, feature, ADR. Labels per module (`M1`…`M10`).
- [ ] Project board (GitHub Projects) mirroring the phases in `docs/01`.
- [ ] `.gitignore` covering `cdk.out/`, `node_modules/`, `.venv/`, `*.env`, `.aws/`.
- [ ] Dependabot enabled for `pip`, `npm`, `github-actions`.
- [ ] License decided (MIT if you might open-source; "All rights reserved" otherwise).

## C. Local tooling (both laptops)

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.12 | Lambdas + CDK |
| `uv` or `pipx` + Poetry | latest | Dependency management |
| Node.js | 20 LTS | CDK CLI, frontend |
| AWS CDK CLI | v2 latest | `npm i -g aws-cdk` |
| AWS CLI v2 | latest | `aws sso login --profile job-dev` |
| Docker Desktop | latest | Build the Playwright Lambda container image |
| `pre-commit` | latest | `ruff`, `black`, `mypy`, `eslint`, `prettier`, secret scanning (`gitleaks`) |
| VS Code + extensions | — | Python, ESLint, Tailwind, Mermaid preview |

- [ ] `aws sso login` works for both of you against profile `job-dev`.
- [ ] `cdk bootstrap` run once in the account/region.
- [ ] `make dev` (or `just dev`) spins up frontend with mocked API locally.

## D. External accounts & API keys

Store every key in **SSM Parameter Store** (`/<project>/<env>/<name>`, SecureString). Never in code, never in GitHub.

- [ ] Adzuna developer account → `app_id`, `app_key`
- [ ] USAJOBS API key (email registration)
- [ ] Dice partner API — application submitted (not blocking)
- [ ] Greenhouse / Lever / Ashby: no keys needed; just the board tokens per target company (stored per user, not as secrets)
- [ ] Gmail: decide between (a) auto-forward C2C emails to an SES inbound address, or (b) Gmail API OAuth per user. (a) is simpler for v1.
- [ ] Domain name (optional for v1; CloudFront default URL works). If bought: Route 53 hosted zone + ACM cert in `us-east-1`.

## E. Data you need before the first run

- [ ] Your **base resume in structured JSON** (name, summary, skills, experience[], education[], certifications[]). This is the source of truth the tailoring module reorders from; it is never allowed to invent beyond it.
- [ ] Base resume DOCX template (one column, standard headings, no tables/text boxes/graphics) — this is the ATS-safe skeleton the renderer fills.
- [ ] Preferences filled: target titles, keywords, locations/remote, work types (C2C/W2/FT), rate & salary floor, target companies, excluded companies.
- [ ] Standard application answers (work authorization, relocation, notice period, etc.) — the apply worker reads these; the user fills them once in settings.

## F. Compliance & conduct decisions (write an ADR for each)

- [ ] Sources policy: only documented APIs, RSS, and the user's own inbox. No scraping of LinkedIn/Indeed.
- [ ] Apply policy: review gate by default; auto-apply opt-in per ATS family; daily cap; no CAPTCHA solving; no stored third-party credentials.
- [ ] Data retention: raw job descriptions 90 days; tailored resumes retained until user deletes; account deletion purges everything within 24h.
- [ ] Privacy note for other users: what is stored, where, who can see it (only them + you as the operator).

## G. Documentation set to have in place before Phase 1

| Doc | Location | Status |
|---|---|---|
| Architecture blueprint | `docs/01-architecture-blueprint.md` | ✅ this pack |
| Module breakdown | `docs/02-module-breakdown.md` | ✅ this pack |
| Prerequisites checklist | `docs/03-prerequisites-checklist.md` | ✅ this pack |
| ADR template + ADR-0001 (region), 0002 (CDK), 0003 (sources policy), 0004 (apply policy) | `docs/adr/` | ⬜ |
| OpenAPI spec v0.1 | `docs/api/openapi.yaml` | ⬜ |
| DynamoDB access patterns table | `docs/data-access-patterns.md` | ⬜ |
| Local dev guide | `docs/dev-setup.md` | ⬜ |
| Runbook (deploy, rollback, rotate keys, on-call basics) | `docs/runbook.md` | ⬜ |
| Post-project: retrospective, cost report, lessons learned | `docs/retro.md` | ⬜ (end) |

## H. Go / no-go gate for Phase 0 → Phase 1

All of the following true:

1. `cdk deploy --all` from a clean clone succeeds in `dev`.
2. A user can sign up via Cognito and load an empty board at the CloudFront URL.
3. Budgets and billing alarm have fired a test notification.
4. CI runs lint + unit tests + `cdk synth` on every PR.
5. ADRs 0001–0004 merged.
