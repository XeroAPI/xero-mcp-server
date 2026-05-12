# Deploying the Xero MCP server

The shared `xero-mcp` Cloud Run service is what every SwiftOtter teammate's Claude Desktop connector talks to. This doc covers how it's wired up, how to ship updates, and how to troubleshoot the failure modes we've already hit.

For the *user-facing* onboarding flow (what teammates do once the service is live), see `scripts/README-onboarding.md`.

## What's deployed today

- **GCP project:** `internal-mcps-496022` (shared with other internal MCPs)
- **Cloud Run service:** `xero-mcp` (region `us-central1`)
- **Public URL:** `https://xero-mcp-1074937591843.us-central1.run.app`
  - MCP endpoint: `<URL>/mcp` (advertised via `/.well-known/oauth-protected-resource/mcp`)
  - OAuth discovery: `<URL>/.well-known/oauth-authorization-server`
  - Status: `<URL>/status` (open; `/healthz` is reserved by Cloud Run's frontend and 404s)
- **Container image:** `us-central1-docker.pkg.dev/internal-mcps-496022/xero-mcp/server:latest` (Artifact Registry repo: `xero-mcp`)
- **Runner SA:** `xero-mcp-runner@internal-mcps-496022.iam.gserviceaccount.com`
  - Has `roles/secretmanager.secretAccessor` on `xero-app-id`, `xero-app-secret`, `mcp-jwt-secret`
  - Has `roles/secretmanager.admin` at project level (unconditional — needed to create per-user `xero-refresh-token-<sub>` secrets on the fly when teammates OAuth in)
- **Deployer SA:** `xero-mcp-deployer@internal-mcps-496022.iam.gserviceaccount.com`
  - JSON key stored as GitHub repo secret `GCP_SA_KEY` on `swiftotter/xero-mcp-server`
  - Has `cloudbuild.builds.editor`, `artifactregistry.writer`, `run.admin`, `logging.viewer`, plus `iam.serviceAccountUser` on the runner SA
- **Secrets in Secret Manager:**
  - `xero-app-id`, `xero-app-secret` — the SwiftOtter Web app credentials from developer.xero.com (one app, shared)
  - `mcp-jwt-secret` — HS256 signing key for the JWTs the server issues to Claude
  - `xero-refresh-token-<xero_userid>` — per-user; created automatically the first time a teammate completes OAuth
- **Xero Web app:** "SwiftOtter MCP Web" at developer.xero.com
  - Redirect URI: `https://xero-mcp-1074937591843.us-central1.run.app/callback`
  - Granular accounting scopes only (see [granular scopes FAQ](https://developer.xero.com/faq/granular-scopes))
- **Cloud Run knobs:** `min-instances=1` (prevents cold-start state loss), `max-instances=4`, `concurrency=80`, 1 vCPU, 1Gi memory, 3600 s timeout
- **GitHub Actions:** `.github/workflows/ci.yaml` runs on PRs (lint + build + Docker smoke). `.github/workflows/deploy.yaml` runs on push to `main` (Cloud Build + `gcloud run services update`).

## Deploying an update

**The happy path (CI):**
1. Open a PR. CI lints + builds + Docker-smoke-tests the image.
2. Squash-merge into `main`.
3. `deploy.yaml` fires automatically: Cloud Build pushes a new image tagged with the commit SHA, retags as `:latest`, runs `gcloud run services update xero-mcp --image=...:latest`. The service rolls in seconds.

**Caveat:** the workflows are pinned to `runs-on: [self-hosted, Linux, X64]`. If `swiftotter/xero-mcp-server` isn't in the SwiftOtter self-hosted runner group, the runs sit queued. Either get the repo added to the runner group or temporarily change the workflows to `runs-on: ubuntu-latest`.

**The manual path** (when CI isn't ready or you need to ship hot):

```bash
# From the repo root, on a clean tree of what you want to ship
gcloud builds submit \
  --project=internal-mcps-496022 \
  --tag=us-central1-docker.pkg.dev/internal-mcps-496022/xero-mcp/server:$(git rev-parse --short HEAD) \
  --machine-type=e2-medium \
  .

# Retag as :latest
gcloud artifacts docker tags add \
  us-central1-docker.pkg.dev/internal-mcps-496022/xero-mcp/server:$(git rev-parse --short HEAD) \
  us-central1-docker.pkg.dev/internal-mcps-496022/xero-mcp/server:latest \
  --project=internal-mcps-496022

# Roll the service to the new image
gcloud run services update xero-mcp \
  --project=internal-mcps-496022 --region=us-central1 \
  --image=us-central1-docker.pkg.dev/internal-mcps-496022/xero-mcp/server:latest

# Verify
curl -sS https://xero-mcp-1074937591843.us-central1.run.app/.well-known/oauth-authorization-server | jq .
curl -sS https://xero-mcp-1074937591843.us-central1.run.app/status
```

The first deploy in a clean project uses `scripts/deploy-shared.sh` (it also provisions the runner-SA bindings and the `mcp-jwt-secret`). After that, the manual path above or the GitHub Actions workflow are enough.

## Verifying a deploy worked

After rolling, the smoke checks I run from a workstation (no Claude needed):

```bash
URL=https://xero-mcp-1074937591843.us-central1.run.app

# Open endpoints
curl -sS $URL/status                                             # → {"status":"ok"}
curl -sS $URL/.well-known/oauth-authorization-server | jq .      # → metadata document
curl -sS $URL/.well-known/oauth-protected-resource/mcp | jq .    # → resource = $URL/mcp

# Gated endpoints
curl -sS -o /dev/null -w '%{http_code}\n' -X POST $URL/mcp       # → 401 (no auth)

# Full end-to-end with a hand-minted JWT (proves both signing and the
# Streamable HTTP bridge to the stdio child)
PROJECT=internal-mcps-496022
JWT_SECRET=$(gcloud secrets versions access latest --secret=mcp-jwt-secret --project=$PROJECT)
SUB=$(gcloud secrets list --project=$PROJECT --filter='name:xero-refresh-token-' --format='value(name.basename())' | head -1 | sed 's/xero-refresh-token-//')
TOKEN=$(JWT_SECRET="$JWT_SECRET" SUB="$SUB" node --input-type=module -e '
  import jwt from "jsonwebtoken";
  const t = jwt.sign(
    { sub: process.env.SUB, typ: "access", client_id: "test",
      iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+600 },
    process.env.JWT_SECRET.trim(),
    { algorithm: "HS256", issuer: "xero-mcp-server", audience: "xero-mcp-server" });
  process.stdout.write(t);
')
curl -sS -X POST $URL/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}'
# Expect: HTTP 200, SSE chunk containing `serverInfo: { name: "Xero MCP Server" }`
```

If all four green, the new revision is healthy and Claude Desktop traffic will work.

## Rotating credentials

- **JWT signing key (`mcp-jwt-secret`).** Rotating invalidates every active session — every teammate has to remove + re-add the connector. Don't rotate unless you suspect compromise.
  ```bash
  openssl rand -hex 32 | tr -d '\n' | \
    gcloud secrets versions add mcp-jwt-secret --project=internal-mcps-496022 --data-file=-
  gcloud run services update xero-mcp --project=internal-mcps-496022 --region=us-central1
  ```
  Note the `tr -d '\n'` — `openssl rand -hex` emits a trailing newline by default, and the server does its own `.trim()` defensively, but it's cleaner to strip it at write time.
- **Xero app client secret.** Generate a new one in developer.xero.com (under your app's Configuration tab → Generate a secret), then:
  ```bash
  printf '%s' '<new Xero client_secret>' | \
    gcloud secrets versions add xero-app-secret --project=internal-mcps-496022 --data-file=-
  gcloud run services update xero-mcp --project=internal-mcps-496022 --region=us-central1
  ```
  All current Claude sessions stay valid (JWT signing key unchanged); but in-flight Xero token refreshes will fail until users re-authorize.
- **Per-user refresh token (`xero-refresh-token-<sub>`).** Don't rotate by hand. Either the user re-runs the OAuth flow (Settings → Connectors → remove + add) or you delete their secret and they re-authorize on next use.

## Offboarding a teammate

```bash
# Find their Xero user id (xero_userid) — either from Cloud Run logs around
# their /authorize → /callback events, or from the Xero org Users page.
SUB=<their-xero-userid>
gcloud secrets delete "xero-refresh-token-${SUB}" --project=internal-mcps-496022
```

Their JWT access token continues to work until it expires (max 1 hour). The next refresh tries to read the now-deleted secret, fails, and Claude Desktop has to re-authorize — at which point Xero rejects them (assuming you also revoked their Xero org access, which is the real source of truth).

## Troubleshooting (failures we've actually hit)

| Symptom | Root cause | Fix |
|---|---|---|
| `gcloud run deploy` succeeds but Cloud Run reports "container failed to start and listen on PORT=8080" | Two-step deploy script set `PUBLIC_URL=__placeholder__`; entrypoint called `new URL(publicUrl)` which threw | `deploy-shared.sh` now computes the deterministic Cloud Run URL `https://<service>-<project-number>.<region>.run.app` up-front and passes it as `PUBLIC_URL` on first deploy |
| `/healthz` returns Google-branded 404 | Cloud Run's HTTP frontend reserves the `/healthz` path before requests reach the container | Hit `/status` instead |
| Claude shows `McpEndpointNotFound: no MCP server was found at the provided URL` after OAuth | Server's resource URL wasn't advertised, so Claude POSTed to `/` | Set `resourceServerUrl: <URL>/mcp` on `mcpAuthRouter`; advertised at `/.well-known/oauth-protected-resource/mcp` |
| Every MCP call returns `{"error":"server_error","error_description":"Internal Server Error"}` | JWT signature verification rejected because the env var has a trailing newline | `.trim()` `MCP_JWT_SECRET`, `XERO_APP_CLIENT_ID`, `XERO_APP_CLIENT_SECRET` at startup. Existing tokens invalidated — users re-add the connector once |
| Every MCP call returns 400 with no useful body | `mcp-session-id` header carried over from a previous container; new container's session map is empty | Return 404 for unknown session ids so Claude drops the stale id and re-initializes |
| `/token` returns `invalid_client` after the service auto-scales | DCR clients store is in-memory and Cloud Run scaled to zero | `min-instances=1` keeps the container warm; `getClient` also synthesizes a client object for unknown client_ids (security gate is PKCE + JWT + redirect_uri allowlist, not client_id) |
| Cloud Run logs show repeated `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` warnings from express-rate-limit | App didn't trust the proxy in front of it | `app.set("trust proxy", 1)` in the entrypoint |
| Xero audit log shows "System Generated, MCP for Accounting Software" not the real user name | Xero attributes API actions to the OAuth client (app), not to the user who authorized — **by design** | Either (a) live with it + rely on Cloud Logging for user-level audit, (b) register one Xero Web app per teammate, or (c) auto-post a History note on every write naming the user. Open question. |

## Reading logs

```bash
# Tail recent requests (HTTP status + path)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="xero-mcp"' \
  --project=internal-mcps-496022 --limit=50 \
  --format='value(timestamp,severity,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)'

# Application stderr/stdout (the [oauth] / [mcp-handler] / [entrypoint] lines)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="xero-mcp" AND textPayload!=""' \
  --project=internal-mcps-496022 --limit=50 \
  --format='value(timestamp,severity,textPayload)'
```

Or hit the Cloud Console Log Explorer with the filter `resource.type="cloud_run_revision" AND resource.labels.service_name="xero-mcp"`.

## Cost

At SwiftOtter's scale (~20 teammates, sporadic MCP usage), Cloud Run + Cloud Build + Artifact Registry + Secret Manager comes to **single-digit dollars per month**. `min-instances=1` is the biggest line item (one always-on vCPU + 1Gi memory ≈ $10–15/mo); the rest is rounding.

## Files

- `Dockerfile` — multi-stage build, final stage runs `node /app/dist/cloud-run-entrypoint.js`
- `src/cloud-run-entrypoint.ts` — Express wiring; mounts OAuth + MCP routers, CORS, `/status`, `/favicon.ico`
- `src/oauth-server.ts` — OAuth 2.1 authorization server: `/authorize` (chains to Xero), `/callback`, `/token`, `/register`, JWT issue/verify
- `src/mcp-handler.ts` — JWT-gated `/mcp` Streamable HTTP transport with per-session stdio children
- `src/clients/auth/authorization-code-xero-client.ts` — runtime Xero refresh-token grant, used inside the per-session child
- `scripts/deploy-shared.sh` — first-time + idempotent deploy of the shared service
- `scripts/README-onboarding.md` — admin runbook (one-time GCP setup + per-user onboarding)
- `.github/workflows/{ci,deploy}.yaml` — CI / deploy automation
