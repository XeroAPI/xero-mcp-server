# Quick Start: Deploy to Cloud Run in 10 Minutes

This guide will get your Xero MCP Server running on Google Cloud Run as quickly as possible.

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

# Authentication secrets
openssl rand -base64 32 | gcloud secrets create jwt-secret --data-file=-
openssl rand -base64 32 | gcloud secrets create api-key --data-file=-
echo -n "admin123" | gcloud secrets create auth-password --data-file=-
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

## Step 5: Test

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe xero-mcp-server --region us-central1 --format 'value(status.url)')

# Test health
curl $SERVICE_URL/health

# Get auth token
curl -X POST $SERVICE_URL/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token'
```

## Step 6: Connect to Claude.ai

1. Go to Claude.ai → Settings → Integrations
2. Add MCP Server:
   - **URL**: Your `SERVICE_URL` from above
   - **Auth**: Use API key or JWT token

```bash
# Get your API key
gcloud secrets versions access latest --secret=api-key
```

3. Test in Claude: "List my Xero contacts"

## Done! 🎉

Your Xero MCP Server is now running on Cloud Run.

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

**Xero auth fails?**
- Verify secrets: `gcloud secrets describe xero-client-id`
- Check custom connection is active in Xero

**Need help?**
- GitHub Issues: https://github.com/XeroAPI/xero-mcp-server/issues
