# Xero MCP Server - Cloud Run Deployment Guide

This guide explains how to deploy the Xero MCP Server to Google Cloud Run, making it accessible from Claude.ai and other MCP clients via HTTP.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Authentication Configuration](#authentication-configuration)
- [Connecting from Claude.ai](#connecting-from-claudeai)
- [Testing the Deployment](#testing-the-deployment)
- [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
- [Security Considerations](#security-considerations)

## Architecture Overview

### Deployment Architecture

```
Claude.ai User
    ↓
    ↓ (HTTPS + JWT/API Key)
    ↓
Google Cloud Run (Xero MCP Server)
    ↓
    ↓ (OAuth2 - Fixed Credentials)
    ↓
Xero API
```

### Authentication Layers

1. **Claude.ai → MCP Server**: JWT tokens or API keys (configurable)
2. **MCP Server → Xero**: Fixed OAuth2 client credentials (environment variables)

This means:
- All authenticated users share access to the same Xero organization
- The MCP server secures access using JWT or API key authentication
- Xero credentials are stored securely in Google Cloud Secret Manager

## Prerequisites

### Required Accounts

1. **Google Cloud Platform Account**
   - Project with billing enabled
   - Permissions to deploy Cloud Run services
   - [Sign up here](https://cloud.google.com/free)

2. **Xero Developer Account**
   - Custom Connection configured
   - Client ID and Client Secret
   - [Create custom connection](https://developer.xero.com/documentation/guides/oauth2/custom-connections/)

### Required Tools

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Verify installation
gcloud --version

# Install Docker (for local testing)
# https://docs.docker.com/get-docker/

# Verify installation
docker --version
```

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/XeroAPI/xero-mcp-server.git
cd xero-mcp-server

# Copy environment example
cp .env.cloudrun.example .env

# Edit .env with your configuration
nano .env
```

### 2. Set Environment Variables

```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"  # or your preferred region
```

### 3. Create Secrets in Google Cloud

```bash
# Xero credentials (required)
gcloud secrets create xero-client-id --data-file=- <<< 'YOUR_XERO_CLIENT_ID'
gcloud secrets create xero-client-secret --data-file=- <<< 'YOUR_XERO_CLIENT_SECRET'

# Authentication secrets (recommended)
gcloud secrets create jwt-secret --data-file=- <<< '$(openssl rand -base64 32)'
gcloud secrets create api-key --data-file=- <<< '$(openssl rand -base64 32)'
gcloud secrets create auth-password --data-file=- <<< 'YOUR_SECURE_PASSWORD'
```

### 4. Deploy to Cloud Run

```bash
# Run the deployment script
./deploy.sh
```

The script will:
- Enable required GCP APIs
- Create Artifact Registry repository
- Build Docker image
- Deploy to Cloud Run
- Output the service URL

## Detailed Setup

### Step 1: Configure Xero Custom Connection

1. Go to [Xero Developer Portal](https://developer.xero.com/app/manage)
2. Click "New App" → "Custom Connection"
3. Configure scopes (required scopes are in `src/clients/xero-client.ts:92-93`):
   - `accounting.transactions`
   - `accounting.contacts`
   - `accounting.settings`
   - `accounting.reports.read`
   - `payroll.settings`
   - `payroll.employees`
   - `payroll.timesheets`
4. Generate credentials and save:
   - Client ID
   - Client Secret
5. Connect to your Xero organization

### Step 2: Configure Google Cloud Project

```bash
# Authenticate with Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID

# Enable billing (required for Cloud Run)
# Do this in the GCP Console: https://console.cloud.google.com/billing
```

### Step 3: Create Secrets

Use Google Cloud Secret Manager to securely store credentials:

```bash
# Required: Xero credentials
echo -n "YOUR_XERO_CLIENT_ID" | gcloud secrets create xero-client-id --data-file=-
echo -n "YOUR_XERO_CLIENT_SECRET" | gcloud secrets create xero-client-secret --data-file=-

# Recommended: Authentication secrets
openssl rand -base64 32 | gcloud secrets create jwt-secret --data-file=-
openssl rand -base64 32 | gcloud secrets create api-key --data-file=-
echo -n "YOUR_ADMIN_PASSWORD" | gcloud secrets create auth-password --data-file=-

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding xero-client-id \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Repeat for other secrets
for SECRET in xero-client-secret jwt-secret api-key auth-password; do
    gcloud secrets add-iam-policy-binding $SECRET \
        --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor"
done
```

### Step 4: Deploy

#### Option A: Using the deployment script (recommended)

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
./deploy.sh
```

#### Option B: Manual deployment

```bash
# Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/xero-mcp-server

# Deploy to Cloud Run
gcloud run deploy xero-mcp-server \
    --image gcr.io/YOUR_PROJECT_ID/xero-mcp-server \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "AUTH_ENABLED=true,ALLOWED_ORIGINS=https://claude.ai" \
    --set-secrets "XERO_CLIENT_ID=xero-client-id:latest,XERO_CLIENT_SECRET=xero-client-secret:latest,JWT_SECRET=jwt-secret:latest,API_KEY=api-key:latest" \
    --min-instances 0 \
    --max-instances 10 \
    --memory 512Mi
```

## Authentication Configuration

The server supports three authentication modes:

### 1. No Authentication (Development Only)

```bash
# Deploy with AUTH_ENABLED=false
gcloud run services update xero-mcp-server \
    --update-env-vars AUTH_ENABLED=false
```

**⚠️ Warning**: This allows unauthenticated access to your Xero data. Only use for testing!

### 2. API Key Authentication

```bash
# Get your API key from Secret Manager
API_KEY=$(gcloud secrets versions access latest --secret=api-key)

# Use in requests
curl -H "x-api-key: $API_KEY" https://YOUR_SERVICE_URL/mcp
```

### 3. JWT Token Authentication (Recommended)

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe xero-mcp-server --region us-central1 --format 'value(status.url)')

# Get JWT token
TOKEN=$(curl -X POST $SERVICE_URL/auth/token \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"YOUR_PASSWORD"}' \
    | jq -r '.token')

# Use in requests
curl -H "Authorization: Bearer $TOKEN" https://YOUR_SERVICE_URL/mcp
```

## Connecting from Claude.ai

### Step 1: Get Your Service Details

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe xero-mcp-server --region us-central1 --format 'value(status.url)')
echo "Service URL: $SERVICE_URL"

# Get API key
API_KEY=$(gcloud secrets versions access latest --secret=api-key)
echo "API Key: $API_KEY"
```

### Step 2: Configure in Claude.ai

1. Go to [Claude.ai](https://claude.ai)
2. Navigate to Settings → Integrations → MCP Servers
3. Click "Add MCP Server"
4. Configure:

```json
{
  "name": "Xero MCP Server",
  "url": "YOUR_SERVICE_URL",
  "authentication": {
    "type": "api_key",
    "header": "x-api-key",
    "value": "YOUR_API_KEY"
  }
}
```

Or with JWT:

```json
{
  "name": "Xero MCP Server",
  "url": "YOUR_SERVICE_URL",
  "authentication": {
    "type": "bearer",
    "token": "YOUR_JWT_TOKEN"
  }
}
```

### Step 3: Test the Connection

In Claude.ai, try:

```
List my Xero contacts
```

or

```
Show me recent invoices
```

## Testing the Deployment

### Health Checks

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe xero-mcp-server --region us-central1 --format 'value(status.url)')

# Test health endpoint (no auth required)
curl $SERVICE_URL/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "xero-mcp-server",
#   "timestamp": "2025-10-26T..."
# }

# Test readiness endpoint
curl $SERVICE_URL/ready
```

### Authentication Test

```bash
# Get token
TOKEN=$(curl -X POST $SERVICE_URL/auth/token \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"YOUR_PASSWORD"}' \
    | jq -r '.token')

# Test MCP endpoint
curl -X POST $SERVICE_URL/mcp \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }'
```

### Local Testing

Before deploying to Cloud Run, test locally:

```bash
# Install dependencies
npm install

# Build
npm run build

# Set environment variables
export XERO_CLIENT_ID="your_client_id"
export XERO_CLIENT_SECRET="your_client_secret"
export AUTH_ENABLED="true"
export JWT_SECRET="test-secret"
export API_KEY="test-api-key"
export AUTH_PASSWORD="test-password"

# Run HTTP server
npm run start:http

# Test in another terminal
curl http://localhost:8080/health
```

### Docker Testing

```bash
# Build image
docker build -t xero-mcp-server .

# Run container
docker run -p 8080:8080 \
    -e XERO_CLIENT_ID="your_id" \
    -e XERO_CLIENT_SECRET="your_secret" \
    -e AUTH_ENABLED="true" \
    -e JWT_SECRET="test-secret" \
    xero-mcp-server

# Test
curl http://localhost:8080/health
```

## Monitoring and Troubleshooting

### View Logs

```bash
# Stream logs
gcloud run services logs tail xero-mcp-server --region us-central1

# View recent logs
gcloud run services logs read xero-mcp-server --region us-central1 --limit 50
```

### Common Issues

#### 1. Authentication Errors

**Error**: `401 Unauthorized`

**Solution**:
- Verify JWT secret is correct
- Check token hasn't expired (24h lifetime)
- Ensure API key matches the secret

#### 2. Xero Connection Errors

**Error**: `Failed to get Xero token`

**Solution**:
- Verify Xero client ID and secret in Secret Manager
- Check custom connection is active in Xero
- Ensure required scopes are configured

#### 3. Container Startup Issues

**Error**: Service not responding

**Solution**:
```bash
# Check if secrets are accessible
gcloud run services describe xero-mcp-server --region us-central1

# Verify secret bindings
gcloud secrets describe xero-client-id
```

### Performance Monitoring

```bash
# View metrics in GCP Console
gcloud run services describe xero-mcp-server \
    --region us-central1 \
    --format "value(status.url)"
```

Go to: [Cloud Run Metrics](https://console.cloud.google.com/run)

## Security Considerations

### Production Checklist

- [ ] Enable authentication (`AUTH_ENABLED=true`)
- [ ] Use strong JWT secret (32+ random bytes)
- [ ] Use strong API key (32+ random bytes)
- [ ] Use strong admin password
- [ ] Restrict CORS origins to Claude.ai only
- [ ] Store all credentials in Secret Manager
- [ ] Enable Cloud Run audit logging
- [ ] Set up VPC Service Controls (optional)
- [ ] Enable DDoS protection (Cloud Armor - optional)
- [ ] Implement rate limiting (optional)
- [ ] Monitor logs for suspicious activity

### Rotating Secrets

```bash
# Create new secret version
echo -n "NEW_SECRET_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-

# Cloud Run will automatically use the latest version
# Or force a new deployment:
gcloud run services update xero-mcp-server --region us-central1
```

### Network Security

```bash
# Restrict to specific IP ranges (optional)
gcloud run services update xero-mcp-server \
    --ingress internal-and-cloud-load-balancing \
    --region us-central1
```

### Audit Logging

```bash
# Enable audit logs
gcloud logging read "resource.type=cloud_run_revision" \
    --limit 50 \
    --format json
```

## Cost Optimization

Cloud Run pricing is based on:
- CPU and memory usage
- Request count
- Egress traffic

### Minimize Costs

1. **Use minimum instances = 0** (cold starts are acceptable for MCP)
2. **Right-size resources**: Start with 256Mi memory, 1 CPU
3. **Set request timeout**: 300s is usually sufficient
4. **Monitor usage**: Use GCP billing reports

### Estimated Costs

For typical usage (< 1000 requests/month):
- **Free tier**: First 2 million requests free
- **Expected cost**: $0-5/month

## Advanced Configuration

### Custom Domain

```bash
# Map custom domain
gcloud run domain-mappings create --service xero-mcp-server \
    --domain mcp.yourdomain.com \
    --region us-central1
```

### Environment-Specific Deployments

```bash
# Deploy staging environment
gcloud run deploy xero-mcp-server-staging \
    --image gcr.io/YOUR_PROJECT/xero-mcp-server:staging \
    --set-secrets "XERO_CLIENT_ID=xero-client-id-staging:latest"
```

### CI/CD Integration

See `deploy.sh` as a starting point for GitHub Actions or Cloud Build.

## Support

For issues and questions:
- **GitHub Issues**: https://github.com/XeroAPI/xero-mcp-server/issues
- **Xero Developer Forum**: https://developer.xero.com/community
- **MCP Documentation**: https://modelcontextprotocol.io/

## License

MIT License - See LICENSE file for details
