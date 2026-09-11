.PHONY: help dev deploy deploy-dev synth lint format test clean

ACCOUNT_ID := 816079798423
REGION := us-east-1

help:
	@echo "jobhunter — automated job search platform"
	@echo "make synth          — cdk synth (no AWS calls)"
	@echo "make deploy-dev     — deploy to dev environment"
	@echo "make deploy         — deploy to prod environment"
	@echo "make lint           — ruff check, mypy, eslint"
	@echo "make format         — ruff check --fix, black, prettier"
	@echo "make test           — run tests"
	@echo "make clean          — remove build artifacts"

synth:
	cd infra && uv run cdk synth

deploy-dev: synth
	cd infra && uv run cdk deploy --all \
		--require-approval never \
		--outputs-file cdk-outputs.json \
		-c env=dev \
		-c account=$(ACCOUNT_ID) \
		-c region=$(REGION)
	./scripts/deploy_web.sh dev

deploy: synth
	cd infra && uv run cdk deploy --all \
		--require-approval never \
		--outputs-file cdk-outputs.json \
		-c env=prod \
		-c account=$(ACCOUNT_ID) \
		-c region=$(REGION)
	./scripts/deploy_web.sh prod

lint:
	uv run ruff check infra/ services/ web/src/
	uv run mypy infra/ services/ --ignore-missing-imports || true
	cd web && npm run lint || true

format:
	uv run ruff check --fix infra/ services/
	uv run black infra/ services/
	cd web && npm run format || true

test:
	uv run pytest tests/ -v

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf infra/cdk.out/ node_modules/ .venv/

.EXPORT_ALL_VARIABLES:
AWS_REGION = $(REGION)
CDK_DEFAULT_ACCOUNT = $(ACCOUNT_ID)
CDK_DEFAULT_REGION = $(REGION)
