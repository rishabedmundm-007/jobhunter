#!/usr/bin/env bash
# Builds the React SPA against the just-deployed backend's CDK outputs and
# publishes it to S3 + invalidates CloudFront. Run after `cdk deploy --all`
# has produced infra/cdk-outputs.json (see Makefile deploy-dev/deploy targets).
set -euo pipefail

ENV_NAME="${1:-dev}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUTS_FILE="$ROOT_DIR/infra/cdk-outputs.json"

if [ ! -f "$OUTPUTS_FILE" ]; then
  echo "Missing $OUTPUTS_FILE — run 'cdk deploy --all --outputs-file cdk-outputs.json' first." >&2
  exit 1
fi

api_url=$(jq -r ".\"jobhunter-api-$ENV_NAME\".HttpApiEndpoint" "$OUTPUTS_FILE")
ws_url=$(jq -r ".\"jobhunter-api-$ENV_NAME\".WebSocketUrl" "$OUTPUTS_FILE")
cognito_domain=$(jq -r ".\"jobhunter-auth-$ENV_NAME\".CognitoDomain" "$OUTPUTS_FILE")
cognito_client_id=$(jq -r ".\"jobhunter-auth-$ENV_NAME\".UserPoolClientId" "$OUTPUTS_FILE")
web_bucket=$(jq -r ".\"jobhunter-web-$ENV_NAME\".WebBucketName" "$OUTPUTS_FILE")
distribution_id=$(jq -r ".\"jobhunter-web-$ENV_NAME\".DistributionId" "$OUTPUTS_FILE")
cloudfront_url=$(jq -r ".\"jobhunter-web-$ENV_NAME\".CloudFrontUrl" "$OUTPUTS_FILE")

for name in api_url ws_url cognito_domain cognito_client_id web_bucket distribution_id; do
  if [ -z "${!name}" ] || [ "${!name}" = "null" ]; then
    echo "Missing output: $name — check $OUTPUTS_FILE" >&2
    exit 1
  fi
done

cat > "$ROOT_DIR/web/.env.production" <<EOF
VITE_API_URL=${api_url%/}
VITE_WS_URL=${ws_url}
VITE_COGNITO_DOMAIN=${cognito_domain}
VITE_COGNITO_CLIENT_ID=${cognito_client_id}
EOF

echo "Wrote web/.env.production:"
cat "$ROOT_DIR/web/.env.production"

cd "$ROOT_DIR/web"
npm install
npm run build

aws s3 sync dist/ "s3://$web_bucket" --delete
aws cloudfront create-invalidation --distribution-id "$distribution_id" --paths "/*" >/dev/null

echo ""
echo "Deployed: $cloudfront_url"
