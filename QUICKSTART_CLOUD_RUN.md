# Quick Start: Deploy to Cloud Run in 10 Minutes

This guide will get your Xero MCP Server running on Google Cloud Run with OAuth 2.0 authentication for Claude.ai.

## Prerequisites

- Google Cloud account with billing enabled
- Xero Custom Connection (Client ID + Secret)
- `gcloud` CLI installed

## Step 1: Get Xero Credentials (2 minutes)

1. Go to https://developer.xero.com/app/manage
2. Click "New App" → "Custom Connection"
3. Add required scopes:
   - `accounting.transactions`
   - `accounting.contacts`
   - `accounting.settings`
   - `accounting.reports.read`
   - `payroll.settings`
   - `payroll.employees`
   - `payroll.timesheets`
4. Generate credentials → Copy Client ID and Client Secret

## Step 2: Setup Google Cloud (3 minutes)

```bash
# Login
gcloud auth login

# Set project
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com
```

## Step 3: Create Secrets (2 minutes)

```bash
# Xero credentials (required)
echo -n "YOUR_XERO_CLIENT_ID" | gcloud secrets create xero-client-id --data-file=-
echo -n "YOUR_XERO_CLIENT_SECRET" | gcloud secrets create xero-client-secret --data-file=-

# OAuth 2.0 credentials for Claude.ai
echo -n "claude-ai-client" | gcloud secrets create oauth-client-id --data-file=-
openssl rand -hex 32 | gcloud secrets create oauth-client-secret --data-file=-
openssl rand -base64 32 | gcloud secrets create oauth-token-secret --data-file=-
```

## Step 4: Deploy (3 minutes)

```bash
# Clone repo
git clone https://github.com/XeroAPI/xero-mcp-server.git
cd xero-mcp-server

# Deploy
export GCP_REGION="us-central1"
./deploy.sh
```

## Step 5: Get OAuth Credentials

```bash
# Service URL
SERVICE_URL=$(gcloud run services describe xero-mcp-server --region us-central1 --format 'value(status.url)')

# OAuth Client ID
OAUTH_CLIENT_ID=$(gcloud secrets versions access latest --secret=oauth-client-id)

# OAuth Client Secret
OAUTH_CLIENT_SECRET=$(gcloud secrets versions access latest --secret=oauth-client-secret)

echo "Service URL: $SERVICE_URL"
echo "OAuth Client ID: $OAUTH_CLIENT_ID"
echo "OAuth Client Secret: $OAUTH_CLIENT_SECRET"
```

## Step 6: Test OAuth Flow

```bash
# Get access token
curl -X POST $SERVICE_URL/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$OAUTH_CLIENT_ID&client_secret=$OAUTH_CLIENT_SECRET"
```

## Step 7: Connect to Claude.ai

1. Go to Claude.ai → Settings → Integrations → MCP Servers
2. Add new MCP Server with:

```json
{
  "name": "Xero",
  "url": "YOUR_SERVICE_URL/mcp",
  "auth": {
    "type": "oauth2_client_credentials",
    "token_url": "YOUR_SERVICE_URL/oauth/token",
    "client_id": "YOUR_OAUTH_CLIENT_ID",
    "client_secret": "YOUR_OAUTH_CLIENT_SECRET"
  }
}
```

Replace YOUR_SERVICE_URL, YOUR_OAUTH_CLIENT_ID, and YOUR_OAUTH_CLIENT_SECRET with your values.

3. Test in Claude: "List my Xero contacts"

## Done! 🎉

Your Xero MCP Server is now running on Cloud Run with OAuth 2.0 authentication.

## Next Steps

- Read [full deployment guide](CLOUD_RUN_DEPLOYMENT.md)
- Set up custom domain
- Configure monitoring
- Enable CI/CD

## Costs

Typical usage: **$0-5/month** (first 2M requests free)

## Troubleshooting

**Health check fails?**
```bash
gcloud run services logs tail xero-mcp-server --region us-central1
```

**OAuth token fails?**
- Verify secrets: `gcloud secrets describe oauth-client-id`
- Check client credentials match

**Xero auth fails?**
- Verify Xero secrets: `gcloud secrets describe xero-client-id`
- Check custom connection is active in Xero

**Need help?**
- GitHub Issues: https://github.com/XeroAPI/xero-mcp-server/issues
