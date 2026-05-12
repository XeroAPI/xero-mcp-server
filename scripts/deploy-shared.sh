#!/usr/bin/env bash
#
# Deploy the shared xero-mcp Cloud Run service.
#
#   ./scripts/deploy-shared.sh
#
# Required env vars (with sensible defaults):
#   GCP_PROJECT      GCP project ID         (default: internal-mcps-496022)
#   GCP_REGION       Cloud Run region       (default: us-central1)
#   IMAGE            Container image ref    (default: <region>-docker.pkg.dev/<project>/xero-mcp/server:latest)
#   RUNNER_SA        Cloud Run service acct (default: xero-mcp-runner@<project>.iam.gserviceaccount.com)
#   SERVICE_NAME     Cloud Run service name (default: xero-mcp)
#
# Assumes one-time setup is done:
#   - Project exists, APIs enabled
#   - xero-mcp-runner SA exists
#   - Artifact Registry repo `xero-mcp` exists in $GCP_REGION
#   - Secret `xero-app-id` and `xero-app-secret` exist (web-app credentials)
#
# Creates if absent:
#   - Secret `mcp-jwt-secret` (HS256 signing key for our access tokens)
#   - IAM bindings on the three shared secrets for the runner SA
#   - Project-level secretAccessor + secretVersionAdder + secretmanager.admin
#     bindings the runner SA needs to create + read per-user
#     `xero-refresh-token-<sub>` secrets on the fly
set -euo pipefail

PROJECT="${GCP_PROJECT:-internal-mcps-496022}"
REGION="${GCP_REGION:-us-central1}"
SVC="${SERVICE_NAME:-xero-mcp}"
IMAGE="${IMAGE:-${REGION}-docker.pkg.dev/${PROJECT}/xero-mcp/server:latest}"
RUNNER_SA="${RUNNER_SA:-xero-mcp-runner@${PROJECT}.iam.gserviceaccount.com}"

echo "Deploying ${SVC} to ${PROJECT}/${REGION}"
echo "Image:  ${IMAGE}"
echo

# 1. Ensure mcp-jwt-secret exists
if ! gcloud secrets describe mcp-jwt-secret --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating mcp-jwt-secret..."
  openssl rand -hex 32 | gcloud secrets create mcp-jwt-secret \
    --project="${PROJECT}" \
    --data-file=-
else
  echo "mcp-jwt-secret already exists"
fi

# 2. Grant runner SA access to shared secrets
for s in xero-app-id xero-app-secret mcp-jwt-secret; do
  gcloud secrets add-iam-policy-binding "$s" \
    --project="${PROJECT}" \
    --member="serviceAccount:${RUNNER_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

# 3. Runner SA needs to create + read per-user xero-refresh-token-<sub> secrets
#    Project-level secretmanager.admin is the simplest path; restricts to the
#    project only. Acceptable because Secret Manager IAM is per-secret elsewhere
#    and we don't want to maintain an allowlist of UUIDs.
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.admin" \
  --condition='expression=resource.name.startsWith("projects/'"${PROJECT}"'/secrets/xero-refresh-token-"),title=xero-refresh-token-only,description=Restrict admin to per-user refresh-token secrets' \
  >/dev/null 2>&1 || \
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.admin" \
  --condition=None >/dev/null

# 4. Deploy
gcloud run deploy "${SVC}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --image="${IMAGE}" \
  --service-account="${RUNNER_SA}" \
  --port=8080 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=4 \
  --concurrency=80 \
  --cpu=1 \
  --memory=1Gi \
  --timeout=3600 \
  --set-secrets="XERO_APP_CLIENT_ID=xero-app-id:latest,XERO_APP_CLIENT_SECRET=xero-app-secret:latest,MCP_JWT_SECRET=mcp-jwt-secret:latest" \
  --set-env-vars="GCP_PROJECT=${PROJECT}" \
  --update-env-vars="PUBLIC_URL=__placeholder__"

# 5. Now that we have the deployed URL, set PUBLIC_URL correctly + redeploy
URL=$(gcloud run services describe "${SVC}" \
  --project="${PROJECT}" --region="${REGION}" \
  --format='value(status.url)')

gcloud run services update "${SVC}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --update-env-vars="PUBLIC_URL=${URL}" >/dev/null

cat <<EOF

Deployed: ${SVC}
Service URL: ${URL}

Next steps:
 1. In the Xero developer portal, add this redirect URI to your Web app:
        ${URL}/callback
 2. Send this URL to your team. They use it as the "Custom connector" URL in
    Claude Desktop -> Settings -> Connectors -> Add custom connector:
        ${URL}
    Claude pops a browser, they sign in at Xero, done.
 3. Health check (no auth needed):
        curl ${URL}/healthz
 4. OAuth discovery (no auth needed):
        curl ${URL}/.well-known/oauth-authorization-server

EOF
