# SwiftOtter team hosting — onboarding runbook

Goal: each teammate uses Claude Desktop against a private Cloud Run instance of `xero-mcp-server` that authenticates to Xero **as them**, so Xero history shows their real name on every action.

The architecture is described in the project root plan at `/Users/bassplayer7/.claude-code/plans/what-s-the-best-way-place-dreamy-owl.md`.

## Pieces

- **One Xero "Web app"** registered at developer.xero.com — gives every teammate a clean OAuth flow.
- **Per-user Cloud Run service** named `xero-mcp-<handle>` — same image, different secrets, IAM-restricted to that user's `@swiftotter.com` Google account.
- **Per-user refresh token** stored in Secret Manager as `refresh-token-<handle>`. Rotated automatically on every token refresh by `AuthorizationCodeXeroClient`.

## One-time admin setup (~2 hours, only on first run)

1. **Register the Xero app** at https://developer.xero.com:
   - Type: **Web app**
   - Redirect URI: `http://localhost:54321/callback`
   - Scopes: `offline_access` plus everything the server uses today (accounting + payroll set).
   - Save the `client_id` and `client_secret`.

2. **Create the GCP project** and enable APIs:
   ```bash
   gcloud projects create swiftotter-xero-mcp
   gcloud config set project swiftotter-xero-mcp
   gcloud services enable run.googleapis.com secretmanager.googleapis.com \
     artifactregistry.googleapis.com cloudbuild.googleapis.com
   ```

3. **Store the shared app credentials** in Secret Manager:
   ```bash
   echo -n "<XERO_CLIENT_ID>"     | gcloud secrets create xero-app-id     --data-file=-
   echo -n "<XERO_CLIENT_SECRET>" | gcloud secrets create xero-app-secret --data-file=-
   ```

4. **Create a runner service account** (used by every per-user service):
   ```bash
   gcloud iam service-accounts create xero-mcp-runner \
     --display-name="xero-mcp Cloud Run runner"

   # Allow it to read the shared app secrets.
   for s in xero-app-id xero-app-secret; do
     gcloud secrets add-iam-policy-binding "$s" \
       --member="serviceAccount:xero-mcp-runner@swiftotter-xero-mcp.iam.gserviceaccount.com" \
       --role="roles/secretmanager.secretAccessor"
   done
   ```

5. **Set up Artifact Registry** and push the image:
   ```bash
   gcloud artifacts repositories create xero-mcp \
     --repository-format=docker --location=us-central1

   gcloud builds submit \
     --tag us-central1-docker.pkg.dev/swiftotter-xero-mcp/xero-mcp/server:latest .
   ```

## Per-user onboarding (~3 min/person)

1. **Bootstrap the refresh token.** Run from this repo (admin can run with the user, or the user can run it themselves with their `gcloud auth` set up):
   ```bash
   npx tsx bin/xero-oauth-bootstrap.ts \
     --user jesse \
     --project swiftotter-xero-mcp \
     --client-id "$(gcloud secrets versions access latest --secret=xero-app-id)" \
     --client-secret "$(gcloud secrets versions access latest --secret=xero-app-secret)"
   ```
   The script prints an authorize URL. Open it in a browser logged in as the teammate, approve the SwiftOtter MCP app for SwiftOtter's Xero org, and the refresh token lands in Secret Manager as `refresh-token-jesse`.

2. **Deploy the user's Cloud Run service:**
   ```bash
   ./scripts/deploy-user.sh jesse jesse@swiftotter.com
   ```
   The script grants IAM, deploys the service, prints the SSE URL plus a Claude Desktop config snippet.

3. **Send the user the Claude Desktop snippet** the script prints. They drop it into `~/Library/Application Support/Claude/claude_desktop_config.json`, run `gcloud auth login` once with their `@swiftotter.com` account, and restart Claude Desktop.

## Removing a user

```bash
USER=jesse
gcloud run services delete "xero-mcp-${USER}" --region=us-central1
gcloud secrets delete "refresh-token-${USER}"
```
The user's gcloud identity loses access automatically when the service is gone.

## Verification checklist (do once after first deploy)

- [ ] Connect from Claude Desktop, run `list_contacts` — returns SwiftOtter contacts.
- [ ] Create a test invoice via Claude. Open it in Xero → **History & Notes**. The actor should be your real name (e.g., "Jesse Maxwell"), not an app name.
- [ ] Wait ~35 minutes (so the access token expires). Run another tool call. Confirm Secret Manager has a new version of `refresh-token-<you>` and the previous version is `DISABLED`.
- [ ] From a different Google account, hit the SSE URL with a token — should get HTTP 403.

## CI / CD

The repo ships two GitHub Actions workflows that run on the SwiftOtter self-hosted runners (`runs-on: [self-hosted, Linux, X64]`):

- **`.github/workflows/ci.yaml`** — runs on every PR and push to `main`. Lints, builds the TypeScript, type-checks the bootstrap CLI, and does a Docker build + SSE smoke-test.
- **`.github/workflows/deploy.yaml`** — runs on push to `main` (or manually via "Run workflow"). Submits a Cloud Build to push `<region>-docker.pkg.dev/<project>/xero-mcp/server:<sha>`, also retags as `:latest`, then runs `scripts/redeploy-all.sh` to roll the new image to every `xero-mcp-*` Cloud Run service.

### One-time CI/CD setup

1. **Create the deployer service account** in the GCP project:
   ```bash
   PROJECT=swiftotter-xero-mcp
   gcloud iam service-accounts create xero-mcp-deployer \
     --project="$PROJECT" \
     --display-name="xero-mcp GitHub Actions deployer"

   SA="xero-mcp-deployer@${PROJECT}.iam.gserviceaccount.com"

   # Cloud Build submitter
   gcloud projects add-iam-policy-binding "$PROJECT" \
     --member="serviceAccount:${SA}" --role="roles/cloudbuild.builds.editor"
   # Push to Artifact Registry
   gcloud projects add-iam-policy-binding "$PROJECT" \
     --member="serviceAccount:${SA}" --role="roles/artifactregistry.writer"
   # Update Cloud Run services (image, env vars)
   gcloud projects add-iam-policy-binding "$PROJECT" \
     --member="serviceAccount:${SA}" --role="roles/run.admin"
   # Required to pass Cloud Run's runtime SA through during update
   gcloud iam service-accounts add-iam-policy-binding \
     "xero-mcp-runner@${PROJECT}.iam.gserviceaccount.com" \
     --project="$PROJECT" \
     --member="serviceAccount:${SA}" --role="roles/iam.serviceAccountUser"
   # Read logs (for the workflow's failure diagnostics)
   gcloud projects add-iam-policy-binding "$PROJECT" \
     --member="serviceAccount:${SA}" --role="roles/logging.viewer"
   ```

2. **Create a JSON key** for the deployer SA (used as a GitHub Actions secret — same pattern as `swiftotter/verdict` and `swiftotter/cove`):
   ```bash
   gcloud iam service-accounts keys create /tmp/xero-mcp-deployer.json \
     --iam-account="$SA" --project="$PROJECT"
   ```

3. **Add the GitHub repo secret**:
   ```bash
   gh secret set GCP_SA_KEY \
     --repo swiftotter/xero-mcp-server \
     --body "$(cat /tmp/xero-mcp-deployer.json)"
   rm /tmp/xero-mcp-deployer.json
   ```
   The workflows read project + region from `env:` blocks at the top — only `GCP_SA_KEY` needs to be a secret. If you ever change projects, edit the `env:` blocks rather than adding a secret.

4. **Self-hosted runner**: the workflows assume the standard SwiftOtter `[self-hosted, Linux, X64]` runner is reachable from `swiftotter/xero-mcp-server`. If not, add the repo to the runner group's allowlist.

### Operational notes

- **Manual rollout** (without going through CI) — run from a workstation that's authed as the deployer SA (or a human equivalent):
  ```bash
  ./scripts/redeploy-all.sh us-central1-docker.pkg.dev/swiftotter-xero-mcp/xero-mcp/server:abc1234
  ```
- **Skipping rollout** for a code change that shouldn't ship to production: push to a branch and let `ci.yaml` validate, then squash-merge after review. Only `main` triggers `deploy.yaml`.

## Notes

- Refresh tokens die after **60 days of inactivity**. If a teammate goes on extended leave, they re-bootstrap.
- If anyone hits "refresh token rejected" errors, the fix is always: re-run step 1 of per-user onboarding.
- Bumping `--max-instances` above 1 requires adding a token-rotation mutex first — current code assumes one writer per secret.
