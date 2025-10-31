#!/bin/bash

# Xero MCP Server - Cloud Run Deployment Script
# This script builds and deploys the Xero MCP Server to Google Cloud Run

set -e

# Configuration - Update these values
PROJECT_ID="${GCP_PROJECT_ID:-your-gcp-project-id}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="xero-mcp-server"
REPOSITORY_NAME="xero-mcp"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Xero MCP Server - Cloud Run Deployment ===${NC}\n"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if project ID is set
if [ "$PROJECT_ID" = "your-gcp-project-id" ]; then
    echo -e "${RED}Error: Please set GCP_PROJECT_ID environment variable${NC}"
    echo "Example: export GCP_PROJECT_ID=my-project-123"
    exit 1
fi

echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Service Name:${NC} $SERVICE_NAME"
echo ""

# Set the project
echo -e "${GREEN}Setting GCP project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo -e "${GREEN}Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Xero MCP Server Docker images" \
    2>/dev/null || echo "Repository already exists"

# Build the image
IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$SERVICE_NAME:$IMAGE_TAG"
LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$SERVICE_NAME:latest"

echo -e "${GREEN}Building Docker image...${NC}"
echo -e "${YELLOW}Image URL:${NC} $LATEST_URL"

# Build with both tags (gcloud doesn't support multiple --tag, so we'll use latest)
gcloud builds submit --tag $LATEST_URL

# Check if secrets exist, if not, provide instructions
echo -e "${GREEN}Checking for required secrets...${NC}"

SECRETS_MISSING=false

for SECRET in xero-client-id xero-client-secret oauth-client-id oauth-client-secret oauth-token-secret; do
    if ! gcloud secrets describe $SECRET &> /dev/null; then
        echo -e "${YELLOW}Warning: Secret '$SECRET' not found${NC}"
        SECRETS_MISSING=true
    else
        echo -e "  ✓ $SECRET exists"
    fi
done

if [ "$SECRETS_MISSING" = true ]; then
    echo ""
    echo -e "${YELLOW}To create missing secrets, run:${NC}"
    echo ""
    echo "# Xero API credentials (required)"
    echo "gcloud secrets create xero-client-id --data-file=- <<< 'YOUR_XERO_CLIENT_ID'"
    echo "gcloud secrets create xero-client-secret --data-file=- <<< 'YOUR_XERO_CLIENT_SECRET'"
    echo ""
    echo "# OAuth 2.0 credentials for Claude.ai (required)"
    echo "gcloud secrets create oauth-client-id --data-file=- <<< 'claude-ai-client'"
    echo "gcloud secrets create oauth-client-secret --data-file=- <<< '\$(openssl rand -hex 32)'"
    echo "gcloud secrets create oauth-token-secret --data-file=- <<< '\$(openssl rand -base64 32)'"
    echo ""
    read -p "Continue with deployment? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled${NC}"
        exit 1
    fi
fi

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image $LATEST_URL \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "AUTH_ENABLED=true,ALLOWED_ORIGINS=https://claude.ai^:^https://www.claude.ai" \
    --set-secrets "XERO_CLIENT_ID=xero-client-id:latest,XERO_CLIENT_SECRET=xero-client-secret:latest,OAUTH_CLIENT_ID=oauth-client-id:latest,OAUTH_CLIENT_SECRET=oauth-client-secret:latest,OAUTH_TOKEN_SECRET=oauth-token-secret:latest" \
    --min-instances 0 \
    --max-instances 10 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --concurrency 80 \
    --port 8080

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${GREEN}Service URL:${NC} $SERVICE_URL"
echo ""
echo -e "${YELLOW}Health check:${NC} $SERVICE_URL/health"
echo ""

# Get OAuth credentials for display
OAUTH_CLIENT_ID=$(gcloud secrets versions access latest --secret=oauth-client-id 2>/dev/null || echo "not-found")
OAUTH_CLIENT_SECRET=$(gcloud secrets versions access latest --secret=oauth-client-secret 2>/dev/null || echo "not-found")

echo -e "${GREEN}OAuth 2.0 Configuration for Claude.ai:${NC}"
echo "  Token Endpoint: $SERVICE_URL/oauth/token"
echo "  MCP Endpoint: $SERVICE_URL/mcp"
echo "  Client ID: $OAUTH_CLIENT_ID"
echo "  Client Secret: ${OAUTH_CLIENT_SECRET:0:10}... (use: gcloud secrets versions access latest --secret=oauth-client-secret)"
echo ""
echo -e "${YELLOW}Test OAuth flow:${NC}"
echo "curl -X POST $SERVICE_URL/oauth/token \\"
echo "  -H 'Content-Type: application/x-www-form-urlencoded' \\"
echo "  -d 'grant_type=client_credentials&client_id=$OAUTH_CLIENT_ID&client_secret=YOUR_SECRET'"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Test the health endpoint: curl $SERVICE_URL/health"
echo "2. Test OAuth token endpoint (see command above)"
echo "3. Configure in Claude.ai MCP settings:"
echo "   - Server URL: $SERVICE_URL/mcp"
echo "   - OAuth Token URL: $SERVICE_URL/oauth/token"
echo "   - Client ID: $OAUTH_CLIENT_ID"
echo "   - Client Secret: (from Secret Manager)"
echo ""
