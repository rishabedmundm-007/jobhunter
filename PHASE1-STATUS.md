# JobHunter Phase 1 Status

## Project
Automated job search platform. User manually adds jobs → Kanban board workflow → hourly pipeline ingests + matches + tailors resume + applies

## Original Requirements
- Multi-user SaaS (Cognito auth)
- Manual job entry first (Phase 1)
- Kanban board: 8 states (DISCOVERED → SHORTLISTED/FILTERED_OUT → RESUME_READY → APPLIED/SKIPPED → IN_PROGRESS → DECISION)
- Real-time updates via WebSocket
- Cost: <$20/mo for 2 users using Claude Haiku + Bedrock

## Phase 1 Scope (Current)
- [x] Frontend: React dashboard, Kanban UI, Cognito login, API client
- [x] Backend: Lambda CRUD handlers (create/get/update/delete jobs)
- [x] WebSocket: Connect/disconnect handlers
- [x] Infrastructure: CDK stacks (auth, data, api, web)
- [ ] Deploy to AWS
- [ ] End-to-end test

## What's Built
- Frontend: `web/src/` (pages/, components/, services/, types/, utils/)
- Backend: `services/` (api/, websocket/, shared/)
- Infrastructure: `infra/stacks/` (auth.py, data.py, api.py, web.py, pipeline.py, obs.py)

## Next Steps
1. Run `make synth` to verify CDK
2. Run `make deploy-dev` to deploy 6 stacks
3. Build React app: `cd web && npm run build`
4. Deploy to S3 + CloudFront
5. Test end-to-end (sign in, create job, move states)

## AWS Account
- Account ID: 816079798423
- Region: us-east-1
- GitHub Actions: Using IAM user credentials (OIDC failed)
