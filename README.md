# JobHunter Phase 1 Status

## Project
Automated job search platform. User signs up, uploads a resume, sets job preferences → Kanban board workflow → (Phase 2+) hourly pipeline ingests + matches + tailors resume + applies.

## Original Requirements
- Multi-user SaaS (Cognito auth)
- Manual job entry first (Phase 1)
- Kanban board: 8 states (DISCOVERED → SHORTLISTED/FILTERED_OUT → RESUME_READY → APPLIED/SKIPPED → IN_PROGRESS → DECISION)
- Real-time updates via WebSocket
- Cost: <$20/mo for 2 users using Claude Haiku + Bedrock

## Phase 1 Scope — Done
- [x] Cognito auth (hosted UI, self-signup, JWT authorizer on the REST API)
- [x] Onboarding flow: Login → resume upload (skippable) → job preferences → board
- [x] Job preferences: roles, experience level, employment type, work arrangement, preferred location (searchable), sponsorship status — validated server-side against fixed option sets
- [x] Contact profile: first/last name, email, phone, profile photo
- [x] Kanban board: create/move/delete jobs across all 8 states, search + per-state filters
- [x] Real-time updates via WebSocket (job created/moved/deleted pushes to all open tabs)
- [x] Stats panel: totals, conversion rate, per-state distribution
- [x] Account settings & job preferences editable after onboarding (nav drawer)
- [x] Dark mode (persisted, respects OS preference by default)
- [x] Deployed to AWS and tested end-to-end (real Cognito user, real API/WebSocket calls)

## What's Built

**Backend** (`services/`)
- `api/handlers.py` — job CRUD, broadcasts WebSocket updates on every mutation
- `api/profile_handlers.py` — profile/resume/avatar/preferences endpoints, all option sets validated server-side
- `api/auth.py` — reads the verified `sub` from the API Gateway JWT authorizer context
- `shared/ddb.py` — DynamoDB access (jobs, profile, WebSocket connections)
- `shared/broadcast.py` — pushes messages to a user's open WebSocket connections, prunes dead ones
- `shared/cognito.py` — verifies WebSocket connect tokens via Cognito `GetUser`
- `shared/http.py` — shared JSON response helper (handles DynamoDB `Decimal` types)
- `websocket/connect.py`, `disconnect.py`, `authorizer.py` — connection lifecycle + Lambda authorizer

**Infrastructure** (`infra/stacks/`)
- `auth.py` — Cognito user pool, hosted UI, OAuth client wired to the CloudFront domain
- `data.py` — DynamoDB single-table design + GSI1, S3 bucket for resumes/avatars (CORS-enabled, private, presigned-URL access only)
- `api.py` — HTTP API (Cognito JWT authorizer) + WebSocket API (Lambda authorizer); routes for jobs, profile, resume, avatar, preferences
- `web.py` — S3 + CloudFront (Origin Access Control) static hosting
- `pipeline.py` — placeholder; ingestion/matching/tailoring/apply land here in later phases
- `observability.py` — CloudWatch log group

**Frontend** (`web/src/`)
- Pages: `Login`, `Welcome` (resume upload), `Preferences`, `Dashboard`
- Components: `KanbanBoard`, `JobCard`, `CreateJobModal`, `ConfirmDialog`, `StatsPanel`, `Dropdown` (single/multi/searchable), `NavDrawer`, `AvatarMenu`, `EditProfileModal`, `Toggle`, `FluidBackground`
- `hooks/useToast.tsx`, `hooks/useDarkMode.ts`
- Monochrome indigo glass design system, dark mode via a `dark` class on `<html>`

## Deployed Endpoints (dev)
- App: https://dxqg1ec2mdafe.cloudfront.net
- REST API: https://ib4ujm5gxi.execute-api.us-east-1.amazonaws.com
- WebSocket: wss://bt5qrfei64.execute-api.us-east-1.amazonaws.com/dev
- Cognito hosted UI domain: jobhunter-dev.auth.us-east-1.amazoncognito.com

## Known Gaps / Next Steps
- **Self-signup is fully open** — anyone with the link can create an account; no invite gate or email-domain restriction yet.
- **No resume management after onboarding** — you can upload once via the Welcome step, but there's no way to view/replace it afterward.
- **No automated tests** — `tests/` exists with placeholder `__init__.py` files only.
- **Pipeline stack is a placeholder** — job ingestion (M3), matching (M4), resume tailoring (M5), and the apply worker (M6) are all unbuilt; this is the next phase of work.
- **Deploy is manual** — `make deploy-dev` / `scripts/deploy_web.sh`, no CI/CD pipeline wired up yet.

## AWS Account
- Account ID: resolved from the deployer's AWS credentials (`aws sts get-caller-identity`), not hardcoded here — see `Makefile`
- Region: us-east-1
- GitHub Actions: Using IAM user credentials (OIDC failed)
