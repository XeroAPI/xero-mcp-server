#!/usr/bin/env bash
#
# Deploy a per-user xero-mcp Cloud Run service.
#
#   ./scripts/deploy-user.sh <user-handle> <user-email>
#
# Example:
#   ./scripts/deploy-user.sh jesse jesse@swiftotter.com
#
# Assumes you have already run bin/xero-oauth-bootstrap.ts for this user, so
# the secret refresh-token-<user> exists in the project's Secret Manager.
#
# Required env vars (or edit the defaults below):
#   GCP_PROJECT      GCP project ID         (default: swiftotter-xero-mcp)
#   GCP_REGION       Cloud Run region       (default: us-central1)
#   IMAGE            Container image ref    (default: ${REGION}-docker.pkg.dev/${PROJECT}/xero-mcp/server:latest)
#   RUNNER_SA        Cloud Run service acct (default: xero-mcp-runner@${PROJECT}.iam.gserviceaccount.com)
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <user-handle> <user-email>"
  exit 1
fi

USER_HANDLE="$1"
USER_EMAIL="$2"
PROJECT="${GCP_PROJECT:-swiftotter-xero-mcp}"
REGION="${GCP_REGION:-us-central1}"
IMAGE="${IMAGE:-${REGION}-docker.pkg.dev/${PROJECT}/xero-mcp/server:latest}"
RUNNER_SA="${RUNNER_SA:-xero-mcp-runner@${PROJECT}.iam.gserviceaccount.com}"
SVC="xero-mcp-${USER_HANDLE}"
REFRESH_SECRET="refresh-token-${USER_HANDLE}"

if ! [[ "$USER_HANDLE" =~ ^[a-z0-9-]+$ ]]; then
  echo "user-handle must be lowercase letters, digits, or hyphens"
  exit 1
fi

echo "Deploying ${SVC} for ${USER_EMAIL} in ${PROJECT}/${REGION}"

# Confirm the user's refresh-token secret exists before deploying.
if ! gcloud secrets describe "${REFRESH_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Error: secret ${REFRESH_SECRET} not found in ${PROJECT}." >&2
  echo "Run bin/xero-oauth-bootstrap.ts for ${USER_HANDLE} first." >&2
  exit 1
fi

# Grant the runner SA access to read the user's refresh-token secret and write new versions.
gcloud secrets add-iam-policy-binding "${REFRESH_SECRET}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
gcloud secrets add-iam-policy-binding "${REFRESH_SECRET}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretVersionAdder" >/dev/null
gcloud secrets add-iam-policy-binding "${REFRESH_SECRET}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretVersionManager" >/dev/null

REFRESH_SECRET_RESOURCE="projects/${PROJECT}/secrets/${REFRESH_SECRET}"

gcloud run deploy "${SVC}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --image="${IMAGE}" \
  --service-account="${RUNNER_SA}" \
  --no-allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=4 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=3600 \
  --set-secrets="XERO_APP_CLIENT_ID=xero-app-id:latest,XERO_APP_CLIENT_SECRET=xero-app-secret:latest" \
  --set-env-vars="XERO_REFRESH_TOKEN_SECRET_NAME=${REFRESH_SECRET_RESOURCE}"

# Restrict invocation to the specific user.
gcloud run services add-iam-policy-binding "${SVC}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --member="user:${USER_EMAIL}" \
  --role="roles/run.invoker" >/dev/null

URL=$(gcloud run services describe "${SVC}" \
  --project="${PROJECT}" --region="${REGION}" \
  --format='value(status.url)')

cat <<EOF

Deployed: ${SVC}
SSE URL : ${URL}/sse

Send the user this Claude Desktop snippet (their gcloud account must be ${USER_EMAIL}):

{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${URL}/sse",
        "--header",
        "Authorization: Bearer \$(gcloud auth print-identity-token)"
      ]
    }
  }
}

EOF
