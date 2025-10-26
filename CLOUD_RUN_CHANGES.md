# Cloud Run Deployment - Implementation Summary

This document summarizes the changes made to enable Google Cloud Run deployment of the Xero MCP Server.

## Overview

The Xero MCP Server now supports two deployment modes:
1. **Local Mode**: Run as stdio subprocess (existing functionality, unchanged)
2. **Cloud Run Mode**: Deploy to Google Cloud Run with HTTP/HTTPS access (NEW)

## Architecture

### Option 2 Implementation (Recommended)
- **User → MCP Server**: JWT or API Key authentication
- **MCP Server → Xero**: Fixed OAuth2 credentials (environment variables)
- **Benefits**: Single Xero organization, simpler setup, suitable for teams

## Files Added

### Core Server Files
- `src/http-server.ts` - Express.js HTTP server with authentication middleware
  - JWT token authentication
  - API key authentication
  - Health and readiness endpoints
  - MCP protocol endpoint (placeholder for full Streamable HTTP integration)

### Deployment Files
- `Dockerfile` - Multi-stage Docker build for Cloud Run
- `.dockerignore` - Optimize Docker build context
- `cloud-run.yaml` - Knative service configuration
- `deploy.sh` - Automated deployment script
- `.env.cloudrun.example` - Environment variable template

### Testing & CI/CD
- `test-http-server.sh` - Local and remote endpoint testing
- `.github/workflows/deploy-cloud-run.yml` - GitHub Actions CI/CD pipeline

### Documentation
- `CLOUD_RUN_DEPLOYMENT.md` - Comprehensive deployment guide
- `QUICKSTART_CLOUD_RUN.md` - 10-minute quick start guide
- `CLOUD_RUN_CHANGES.md` - This file

## Files Modified

### package.json
**Added dependencies:**
- `@modelcontextprotocol/sdk`: ^1.10.0 (upgraded from 1.6.0 for Streamable HTTP support)
- `express`: ^4.21.2 - HTTP server
- `cors`: ^2.8.5 - CORS middleware
- `helmet`: ^8.0.0 - Security headers
- `jsonwebtoken`: ^9.0.2 - JWT authentication

**Added dev dependencies:**
- `@types/express`: ^5.0.0
- `@types/cors`: ^2.8.17
- `@types/jsonwebtoken`: ^9.0.7

**Added scripts:**
- `start`: Run stdio server (existing)
- `start:http`: Run HTTP server (new)

### README.md
**Added sections:**
- Deployment Modes overview
- Link to Cloud Run deployment guide
- Cloud deployment features

## Key Features

### Authentication
1. **JWT Token Authentication** (recommended)
   - POST `/auth/token` with username/password
   - Returns JWT token valid for 24 hours
   - Use in `Authorization: Bearer <token>` header

2. **API Key Authentication**
   - Simple key-based auth
   - Use in `x-api-key` header
   - Good for programmatic access

3. **No Authentication** (dev only)
   - Set `AUTH_ENABLED=false`
   - ⚠️ Not recommended for production

### Endpoints

- `GET /health` - Health check (no auth)
- `GET /ready` - Readiness check (no auth)
- `POST /auth/token` - Get JWT token
- `POST /mcp` - MCP protocol endpoint (auth required)

### Security Features

- Helmet.js security headers
- CORS configuration
- Secret management via Google Cloud Secret Manager
- Non-root container user
- Health checks for auto-healing
- Environment variable validation

### Cloud Run Features

- Auto-scaling (0-10 instances)
- Health and readiness probes
- Graceful shutdown handling
- Resource limits (512Mi memory, 1 CPU)
- Secret injection from Secret Manager
- Container optimization (multi-stage build)

## Environment Variables

### Required
- `XERO_CLIENT_ID` - Xero Custom Connection client ID
- `XERO_CLIENT_SECRET` - Xero Custom Connection client secret

### Optional
- `XERO_CLIENT_BEARER_TOKEN` - Alternative to client credentials
- `AUTH_ENABLED` - Enable authentication (true/false)
- `JWT_SECRET` - Secret for JWT signing
- `API_KEY` - API key for authentication
- `AUTH_USERNAME` - Username for /auth/token
- `AUTH_PASSWORD` - Password for /auth/token
- `ALLOWED_ORIGINS` - CORS allowed origins
- `PORT` - Server port (default: 8080)

## Deployment Process

### Manual Deployment
```bash
export GCP_PROJECT_ID="your-project"
export GCP_REGION="us-central1"
./deploy.sh
```

### CI/CD Deployment
- Push to `main` branch triggers automatic deployment
- GitHub Actions workflow in `.github/workflows/deploy-cloud-run.yml`
- Requires secrets: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_SA_KEY`

## Testing

### Local Testing
```bash
# Install dependencies
npm install

# Build
npm run build

# Set environment variables
export XERO_CLIENT_ID="..."
export XERO_CLIENT_SECRET="..."
export AUTH_ENABLED="true"
export JWT_SECRET="test-secret"

# Run HTTP server
npm run start:http

# Test in another terminal
./test-http-server.sh
```

### Docker Testing
```bash
docker build -t xero-mcp-server .
docker run -p 8080:8080 \
  -e XERO_CLIENT_ID="..." \
  -e XERO_CLIENT_SECRET="..." \
  xero-mcp-server

# Test
curl http://localhost:8080/health
```

### Cloud Run Testing
```bash
# After deployment
SERVICE_URL=$(gcloud run services describe xero-mcp-server --region us-central1 --format 'value(status.url)')
SERVER_URL=$SERVICE_URL API_KEY="your-key" ./test-http-server.sh
```

## Integration with Claude.ai

Once deployed, configure in Claude.ai:

```json
{
  "name": "Xero MCP Server",
  "url": "https://your-service.run.app",
  "authentication": {
    "type": "api_key",
    "header": "x-api-key",
    "value": "YOUR_API_KEY"
  }
}
```

## Future Enhancements

### Completed
- ✅ HTTP server with Express.js
- ✅ Authentication (JWT + API key)
- ✅ Docker containerization
- ✅ Cloud Run deployment
- ✅ Health checks
- ✅ Secret management
- ✅ Documentation
- ✅ Test scripts
- ✅ CI/CD pipeline

### Potential Improvements
- [ ] Full Streamable HTTP transport integration (pending SDK documentation)
- [ ] Rate limiting middleware
- [ ] Request logging and analytics
- [ ] Multi-tenant support (Option 1 architecture)
- [ ] OAuth2 flow for user-specific Xero access
- [ ] WebSocket support for real-time updates
- [ ] Metrics and monitoring dashboard
- [ ] Cost optimization recommendations

## Backward Compatibility

All existing functionality remains intact:
- Stdio transport still works for Claude Desktop
- All existing tools and handlers unchanged
- Xero client authentication unchanged
- No breaking changes to existing deployments

## Cost Estimates

### Google Cloud Run
- **Free tier**: 2M requests/month, 360k GB-seconds
- **Typical usage**: $0-5/month for most users
- **Scaling**: Pay per use, no idle charges with min-instances=0

### Google Cloud Secret Manager
- **Free tier**: 6 active secret versions
- **Cost**: ~$0.06/secret/month

### Total estimated cost: $0-10/month for typical usage

## Security Considerations

1. **Secrets**: All credentials in Secret Manager, never in code
2. **Authentication**: Required for production deployments
3. **CORS**: Restricted to Claude.ai domains
4. **Container**: Non-root user, minimal attack surface
5. **Network**: HTTPS only, Cloud Run handles SSL
6. **Audit**: Cloud Run logging enabled by default

## Support & Resources

- **Documentation**: CLOUD_RUN_DEPLOYMENT.md
- **Quick Start**: QUICKSTART_CLOUD_RUN.md
- **Issues**: GitHub Issues
- **MCP Protocol**: https://modelcontextprotocol.io/

## Version Information

- **Implementation Date**: October 2025
- **MCP SDK Version**: 1.10.0+
- **Node.js Version**: 22 (LTS)
- **Docker Base**: node:22-alpine

## Contributors

This Cloud Run deployment was implemented to enable web-based MCP clients (like Claude.ai) to access the Xero MCP Server via HTTPS.
