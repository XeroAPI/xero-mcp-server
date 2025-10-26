# OAuth 2.0 Authentication Implementation

This document explains the OAuth 2.0 Client Credentials flow implementation for the Xero MCP Server, which enables Claude.ai and other OAuth-compliant clients to securely connect to the server.

## Overview

The server now implements **OAuth 2.0 Client Credentials Grant** ([RFC 6749 Section 4.4](https://tools.ietf.org/html/rfc6749#section-4.4)), the standard authentication method used by Claude.ai for MCP servers.

## Authentication Flow

```
┌──────────┐                                  ┌──────────────────┐
│          │                                  │                  │
│ Claude.ai│                                  │  Xero MCP Server │
│          │                                  │                  │
└────┬─────┘                                  └────────┬─────────┘
     │                                                 │
     │ 1. POST /oauth/token                           │
     │    grant_type=client_credentials               │
     │    client_id=xxx                               │
     │    client_secret=yyy                           │
     ├────────────────────────────────────────────────>│
     │                                                 │
     │                                        2. Validate
     │                                           Credentials
     │                                                 │
     │ 3. Response:                                   │
     │    {                                           │
     │      "access_token": "jwt...",                │
     │      "token_type": "Bearer",                  │
     │      "expires_in": 3600                       │
     │    }                                           │
     │<────────────────────────────────────────────────┤
     │                                                 │
     │ 4. POST /mcp                                   │
     │    Authorization: Bearer jwt...                │
     │    { MCP protocol request }                    │
     ├────────────────────────────────────────────────>│
     │                                                 │
     │                                        5. Validate
     │                                           Token
     │                                                 │
     │ 6. MCP Response                                │
     │<────────────────────────────────────────────────┤
     │                                                 │
```

## Implementation Details

### Token Endpoint: `POST /oauth/token`

**Request** (application/x-www-form-urlencoded):
```http
POST /oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=claude-ai-client
&client_secret=abc123...
```

**Alternative with Basic Auth**:
```http
POST /oauth/token HTTP/1.1
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

**Success Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Error Responses**:

- **400 Bad Request** - Invalid grant_type or missing parameters:
  ```json
  {
    "error": "unsupported_grant_type",
    "error_description": "Only client_credentials grant type is supported"
  }
  ```

- **401 Unauthorized** - Invalid client credentials:
  ```json
  {
    "error": "invalid_client",
    "error_description": "Invalid client credentials"
  }
  ```

### Protected Endpoints

All MCP endpoints require a valid Bearer token:

```http
POST /mcp HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Error Response** (401 Unauthorized):
```json
{
  "error": "invalid_token",
  "error_description": "Token has expired"
}
```

### Token Introspection: `POST /oauth/introspect`

Optional endpoint for debugging token validity ([RFC 7662](https://tools.ietf.org/html/rfc7662)):

**Request**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "active": true,
  "client_id": "claude-ai-client",
  "scope": "mcp:access",
  "exp": 1730000000,
  "iat": 1729996400
}
```

## Configuration

### Environment Variables

**Required:**
- `OAUTH_CLIENT_ID` - OAuth client identifier for Claude.ai
- `OAUTH_CLIENT_SECRET` - OAuth client secret for Claude.ai
- `OAUTH_TOKEN_SECRET` - Secret key for signing JWT access tokens

**Optional:**
- `AUTH_ENABLED` - Enable/disable authentication (default: false)
- `TOKEN_EXPIRY` - Token lifetime in seconds (default: 3600 = 1 hour)

### Google Cloud Secrets

When deploying to Cloud Run, store credentials in Secret Manager:

```bash
# OAuth credentials for Claude.ai
gcloud secrets create oauth-client-id --data-file=- <<< 'claude-ai-client'
gcloud secrets create oauth-client-secret --data-file=- <<< '$(openssl rand -hex 32)'
gcloud secrets create oauth-token-secret --data-file=- <<< '$(openssl rand -base64 32)'
```

## Security Features

### 1. Constant-Time Comparison
Prevents timing attacks when validating client secrets:

```typescript
const hash1 = crypto.createHash('sha256').update(clientSecret).digest();
const hash2 = crypto.createHash('sha256').update(client.client_secret).digest();
return crypto.timingSafeEqual(hash1, hash2);
```

### 2. JWT Access Tokens
Tokens are signed JWTs with:
- Issuer: `xero-mcp-server`
- Audience: `mcp-api`
- Expiry: Configurable (default 1 hour)
- Scope: `mcp:access`

### 3. HTTPS Only
Cloud Run enforces HTTPS, ensuring credentials are always encrypted in transit.

### 4. Secret Storage
All credentials stored in Google Cloud Secret Manager, never in code or environment files.

## Client Configuration

### For Claude.ai

Configure in Claude.ai Settings → Integrations → MCP Servers:

```json
{
  "name": "Xero",
  "url": "https://your-service.run.app/mcp",
  "auth": {
    "type": "oauth2_client_credentials",
    "token_url": "https://your-service.run.app/oauth/token",
    "client_id": "claude-ai-client",
    "client_secret": "your-oauth-client-secret"
  }
}
```

### For Custom Clients

1. **Get Access Token**:
   ```bash
   curl -X POST https://your-service.run.app/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
   ```

2. **Use Token**:
   ```bash
   curl -X POST https://your-service.run.app/mcp \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```

## Testing

### Local Testing

```bash
# Set environment
export XERO_CLIENT_ID="your_xero_id"
export XERO_CLIENT_SECRET="your_xero_secret"
export AUTH_ENABLED="true"
export OAUTH_CLIENT_ID="test-client"
export OAUTH_CLIENT_SECRET="test-secret"
export OAUTH_TOKEN_SECRET="test-token-secret"

# Start server
npm run start:http

# In another terminal, test OAuth flow
export OAUTH_CLIENT_ID="test-client"
export OAUTH_CLIENT_SECRET="test-secret"
./test-oauth.sh
```

### Cloud Run Testing

```bash
# Get credentials
SERVICE_URL=$(gcloud run services describe xero-mcp-server --region us-central1 --format 'value(status.url)')
CLIENT_ID=$(gcloud secrets versions access latest --secret=oauth-client-id)
CLIENT_SECRET=$(gcloud secrets versions access latest --secret=oauth-client-secret)

# Test
OAUTH_CLIENT_ID=$CLIENT_ID OAUTH_CLIENT_SECRET=$CLIENT_SECRET SERVER_URL=$SERVICE_URL ./test-oauth.sh
```

## Multiple Clients

To support multiple OAuth clients, modify the `OAUTH_CLIENTS` array in `src/http-server.ts`:

```typescript
const OAUTH_CLIENTS: OAuthClient[] = [
  {
    client_id: process.env.OAUTH_CLIENT_ID || "claude-ai-client",
    client_secret: process.env.OAUTH_CLIENT_SECRET || crypto.randomBytes(32).toString('hex'),
    name: "Claude.ai"
  },
  {
    client_id: process.env.OAUTH_CLIENT_ID_2 || "other-client",
    client_secret: process.env.OAUTH_CLIENT_SECRET_2 || crypto.randomBytes(32).toString('hex'),
    name: "Other Service"
  }
];
```

## Comparison with Other Auth Methods

| Method | Claude.ai Support | Security | Complexity | Use Case |
|--------|------------------|----------|------------|----------|
| **OAuth 2.0** | ✅ Yes | ⭐⭐⭐⭐⭐ | Medium | Production, Claude.ai |
| JWT Token | ❌ No | ⭐⭐⭐⭐ | Low | Legacy, testing |
| API Key | ❌ No | ⭐⭐⭐ | Very Low | Legacy, simple clients |
| No Auth | ❌ No | ⭐ | None | Development only |

## Migration from JWT/API Key

If you previously used JWT tokens or API keys:

1. OAuth 2.0 is now the **primary authentication method**
2. Legacy methods still work but are **deprecated**
3. Update your clients to use OAuth 2.0
4. Old environment variables (`JWT_SECRET`, `API_KEY`) are ignored when OAuth is configured

## Troubleshooting

### Issue: Token request returns 401

**Cause**: Invalid client credentials

**Solution**:
```bash
# Verify secrets match
gcloud secrets versions access latest --secret=oauth-client-id
gcloud secrets versions access latest --secret=oauth-client-secret
```

### Issue: Token expires too quickly

**Cause**: Default 1-hour expiry

**Solution**: Increase `TOKEN_EXPIRY`:
```bash
gcloud run services update xero-mcp-server \
  --update-env-vars TOKEN_EXPIRY=7200  # 2 hours
```

### Issue: MCP requests return 401

**Cause**: Token expired or invalid

**Solution**:
1. Get new token from `/oauth/token`
2. Check token introspection: `POST /oauth/introspect`
3. Verify `Authorization: Bearer` header format

## Standards Compliance

This implementation complies with:
- [RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 Authorization Framework
- [RFC 6749 Section 4.4](https://tools.ietf.org/html/rfc6749#section-4.4) - Client Credentials Grant
- [RFC 7662](https://tools.ietf.org/html/rfc7662) - OAuth 2.0 Token Introspection
- [RFC 6750](https://tools.ietf.org/html/rfc6750) - Bearer Token Usage

## Future Enhancements

Potential improvements:
- [ ] Refresh tokens (RFC 6749 Section 1.5)
- [ ] Token revocation (RFC 7009)
- [ ] Scope-based access control
- [ ] Rate limiting per client
- [ ] Client registration endpoint
- [ ] PKCE support for public clients

## References

- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [Claude.ai MCP Documentation](https://claude.ai/docs/mcp)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)
- [JWT.io](https://jwt.io) - Token debugger
