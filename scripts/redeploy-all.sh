#!/usr/bin/env bash
#
# Roll a new image to every per-user xero-mcp Cloud Run service.
#
#   ./scripts/redeploy-all.sh <image>
#
# Example:
#   ./scripts/redeploy-all.sh us-central1-docker.pkg.dev/swiftotter-xero-mcp/xero-mcp/server:abc1234
#
# Without an arg, defaults to <region>-docker.pkg.dev/<project>/xero-mcp/server:latest.
#
# Env (with sensible defaults):
#   GCP_PROJECT      GCP project ID         (default: swiftotter-xero-mcp)
#   GCP_REGION       Cloud Run region       (default: us-central1)
#   SERVICE_FILTER   gcloud filter expr     (default: metadata.name~^xero-mcp-)
set -euo pipefail

PROJECT="${GCP_PROJECT:-swiftotter-xero-mcp}"
REGION="${GCP_REGION:-us-central1}"
DEFAULT_IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/xero-mcp/server:latest"
IMAGE="${1:-${DEFAULT_IMAGE}}"
FILTER="${SERVICE_FILTER:-metadata.name~^xero-mcp-}"

echo "Project : ${PROJECT}"
echo "Region  : ${REGION}"
echo "Image   : ${IMAGE}"
echo "Filter  : ${FILTER}"
echo

services=()
while IFS= read -r line; do
  [ -n "$line" ] && services+=("$line")
done < <(
  gcloud run services list \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --format="value(metadata.name)" \
    --filter="${FILTER}"
)

if [[ ${#services[@]} -eq 0 ]]; then
  echo "No services matched filter '${FILTER}'."
  exit 0
fi

echo "Updating ${#services[@]} service(s):"
printf '  - %s\n' "${services[@]}"
echo

failed=()
for svc in "${services[@]}"; do
  echo "==> ${svc}"
  if gcloud run services update "${svc}" \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --image="${IMAGE}" \
    --quiet; then
    echo "    ok"
  else
    echo "    FAILED" >&2
    failed+=("${svc}")
  fi
  echo
done

if [[ ${#failed[@]} -gt 0 ]]; then
  echo "Failed to update: ${failed[*]}" >&2
  exit 1
fi

echo "All ${#services[@]} service(s) updated to ${IMAGE}."
