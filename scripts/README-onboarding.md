# SwiftOtter team hosting — onboarding runbook

Goal: every teammate connects to the **shared** `xero-mcp` Cloud Run service from Claude Desktop as a custom connector. The first time they click Connect, Claude opens a browser tab and they sign in at Xero. From then on it Just Works. Each Xero call is made with that teammate's own user identity, so Xero's History & Notes shows their real name on every action.

The full design is in `/Users/bassplayer7/.claude-code/plans/what-s-the-best-way-place-dreamy-owl.md`.

## Pieces

- **One Xero "Web app"** at developer.xero.com — used by everyone. The redirect URI is the Cloud Run service's `/callback`.
- **One shared Cloud Run service** named `xero-mcp` — public (`--allow-unauthenticated`), but every MCP route is JWT-gated. The JWTs are minted by the service itself after a successful Xero OAuth flow.
- **Per-user refresh tokens** stored in Secret Manager as `xero-refresh-token-<xero_userid>`. Created on the fly the first time a teammate signs in. Rotated automatically on every Xero refresh.

## One-time admin setup (~1 hour, only on first run)

1. **Register the Xero app** at https://developer.xero.com:
   - Type: **Web app**
   - Integration: OAuth 2.0
   - **OAuth 2.0 redirect URI:** *leave blank for now*; you'll add the Cloud Run callback URL after step 5
   - Generate a client secret. Note the `client_id` and `client_secret`.

2. **Create the GCP project** and enable APIs (if not already done):
   ```bash
   PROJECT=internal-mcps-496022
   gcloud config set project "$PROJECT"
   gcloud services enable run.googleapis.com secretmanager.googleapis.com \
     artifactregistry.googleapis.com cloudbuild.googleapis.com
   ```

3. **Store the Xero app credentials in Secret Manager:**
   ```bash
   printf "%s" "<XERO_CLIENT_ID>"     | gcloud secrets create xero-app-id     --data-file=-
   printf "%s" "<XERO_CLIENT_SECRET>" | gcloud secrets create xero-app-secret --data-file=-
   ```

4. **Create the runner service account and Artifact Registry repo:**
   ```bash
   gcloud iam service-accounts create xero-mcp-runner \
     --display-name="xero-mcp Cloud Run runner"
   gcloud artifacts repositories create xero-mcp \
     --repository-format=docker --location=us-central1
   ```

5. **Build & push the image:**
   ```bash
   gcloud builds submit \
     --tag us-central1-docker.pkg.dev/$PROJECT/xero-mcp/server:latest .
   ```

6. **Deploy the shared service:**
   ```bash
   ./scripts/deploy-shared.sh
   ```
   The script creates `mcp-jwt-secret` if needed, grants IAM on the three shared secrets, gives the runner SA permission to create per-user `xero-refresh-token-*` secrets on the fly, deploys, and prints the service URL.

7. **Add the Cloud Run callback URL to the Xero app:** back in developer.xero.com → your Web app → Configuration → OAuth 2.0 redirect URIs → add `<service URL>/callback` (the deploy script prints this). Save.

## Per-user onboarding (~30 seconds per person)

Send the team a single message:

> Open Claude Desktop → **Settings → Connectors → Add custom connector**. Paste this URL: `<service URL>`. Click **Connect**. A browser pops open — sign in to Xero as yourself, approve the SwiftOtter MCP app, done.

That's the entire setup. No CLI, no config files, no shared tokens.

## Verification (first time only)

- [ ] `curl <service URL>/healthz` returns `{"status":"ok"}` — confirms the service is up
- [ ] `curl <service URL>/.well-known/oauth-authorization-server | jq` returns the OAuth metadata document
- [ ] Add the connector in Claude Desktop yourself, walk the OAuth flow, run `list_contacts` — should return SwiftOtter contacts
- [ ] Ask Claude to create a test invoice. In Xero → History & Notes on the invoice, confirm the actor reads "Jesse Maxwell" (or whoever you signed in as). This is the key audit check.
- [ ] Repeat for a second teammate (Brandon). His invoices should show "Brandon Eckenrode". Confirms per-user isolation.

## Rotating credentials

- **JWT signing key (`mcp-jwt-secret`)**: rotating it invalidates every active session — every teammate has to reconnect via Settings → Connectors. Rotate only on suspected compromise.
  ```bash
  openssl rand -hex 32 | gcloud secrets versions add mcp-jwt-secret --data-file=-
  gcloud run services update xero-mcp --region=us-central1  # force new revision
  ```
- **Xero app client secret**: rotate by adding a new secret in developer.xero.com, then:
  ```bash
  printf "%s" "<new Xero client_secret>" | gcloud secrets versions add xero-app-secret --data-file=-
  gcloud run services update xero-mcp --region=us-central1
  ```

## Offboarding a teammate

When someone leaves SwiftOtter:

```bash
# Find their xero_userid from the Cloud Run logs (look for /authorize → /callback flow)
# or from Xero's user list.
SUB=<their-xero-userid>
gcloud secrets delete "xero-refresh-token-${SUB}"
```

Their JWT will continue to work until it expires (max 1 hour), but as soon as it tries to refresh Xero rejects (refresh token gone). Total worst case: 1 hour of stale access.

Additionally, remove their Xero org membership in developer.xero.com / Xero org settings — that's the source of truth.

## Security posture summary

- **Transport:** HTTPS (Cloud Run terminates TLS, HSTS on by default)
- **Outer auth (Claude Desktop ↔ Cloud Run):** OAuth 2.1 with PKCE S256, JWT bearer tokens (HS256, 1 h access, 30 d refresh), Dynamic Client Registration per the MCP spec
- **Inner auth (Cloud Run ↔ Xero):** OAuth 2.0 Authorization Code with PKCE — refresh tokens persist in Secret Manager
- **Audit trail:** every Xero API call uses the caller's own refresh token, so Xero History & Notes shows real user names
- **Tenant isolation:** each MCP session spawns a fresh child process with only that user's env vars; sessions cannot read each other's data
- **Token storage on user laptops:** Claude Desktop's encrypted credential store (per Anthropic's MCP spec, never written to plain config files)
- **Revocation:** delete a user's `xero-refresh-token-<sub>` secret; their access fails within 1 h
- Full threat model in the plan file

## CI / CD

Two GitHub Actions workflows ship in `.github/workflows/`:

- **`ci.yaml`** — runs on every PR + push to `main`. Lints, type-checks, builds the TypeScript, runs the Docker build + a "container stays up + supergateway listens" smoke test.
- **`deploy.yaml`** — runs on push to `main` (or via `workflow_dispatch`). Submits Cloud Build to push `<region>-docker.pkg.dev/$PROJECT/xero-mcp/server:<sha>`, retags `:latest`, then `gcloud run services update xero-mcp` so the new image rolls out.

The deploy workflow expects a single repo secret: `GCP_SA_KEY` (the deployer service-account JSON). The deployer SA needs: `roles/cloudbuild.builds.editor`, `roles/artifactregistry.writer`, `roles/run.admin`, `roles/iam.serviceAccountUser` (on the runner SA), `roles/logging.viewer`. Setup commands are in the project root or run them by hand following the pattern in `swiftotter/verdict` and `swiftotter/cove`.
