#!/usr/bin/env node

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ToolFactory } from "./tools/tool-factory.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Cookie parser middleware
app.use(cookieParser());

// OAuth 2.0 Configuration
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";
const OAUTH_TOKEN_SECRET = process.env.OAUTH_TOKEN_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";
const TOKEN_EXPIRY = parseInt(process.env.TOKEN_EXPIRY || "2592000"); // 30 days default (Claude.ai doesn't support token refresh)

// OAuth 2.0 Client Credentials
// In production, store these in Secret Manager and support multiple clients
interface OAuthClient {
  client_id: string;
  client_secret: string;
  name: string;
}

const OAUTH_CLIENTS: OAuthClient[] = [
  {
    client_id: process.env.OAUTH_CLIENT_ID || "claude-ai-client",
    client_secret: process.env.OAUTH_CLIENT_SECRET || crypto.randomBytes(32).toString('hex'),
    name: "Claude.ai"
  }
];

// Authorization Code Storage (in-memory)
// In production, use Redis or a database
interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri?: string;
  expires_at: number;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

const authorizationCodes = new Map<string, AuthorizationCode>();

// Clean up expired authorization codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authorizationCodes.entries()) {
    if (data.expires_at < now) {
      authorizationCodes.delete(code);
    }
  }
}, 60000);

// Log client credentials on startup (only in development)
if (process.env.NODE_ENV !== 'production' && AUTH_ENABLED) {
  console.log('\n=== OAuth 2.0 Client Credentials ===');
  OAUTH_CLIENTS.forEach(client => {
    console.log(`Client: ${client.name}`);
    console.log(`  client_id: ${client.client_id}`);
    console.log(`  client_secret: ${client.client_secret}`);
  });
  console.log('===================================\n');
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For OAuth form-encoded requests

/**
 * Validate OAuth client credentials
 */
function validateClient(clientId: string, clientSecret: string): boolean {
  const client = OAUTH_CLIENTS.find(c => c.client_id === clientId);
  if (!client) {
    console.log(`[Validation] Client ID not found: ${clientId}`);
    return false;
  }

  console.log(`[Validation] Found client: ${clientId}`);
  console.log(`[Validation] Expected secret (first 16 chars): ${client.client_secret.substring(0, 16)}...`);
  console.log(`[Validation] Received secret (first 16 chars): ${clientSecret.substring(0, 16)}...`);
  console.log(`[Validation] Expected secret length: ${client.client_secret.length}`);
  console.log(`[Validation] Received secret length: ${clientSecret.length}`);

  // Use constant-time comparison to prevent timing attacks
  const hash1 = crypto.createHash('sha256').update(clientSecret).digest();
  const hash2 = crypto.createHash('sha256').update(client.client_secret).digest();

  const isValid = crypto.timingSafeEqual(hash1, hash2);
  console.log(`[Validation] Validation result: ${isValid}`);

  return isValid;
}

/**
 * Extract client credentials from request
 * Supports both Basic Auth header and request body
 */
function extractClientCredentials(req: Request): { client_id?: string; client_secret?: string } {
  // Check Authorization header (Basic Auth)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.substring(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [client_id, client_secret] = credentials.split(':');
    return { client_id, client_secret };
  }

  // Check request body
  return {
    client_id: req.body.client_id,
    client_secret: req.body.client_secret
  };
}

/**
 * OAuth 2.0 Bearer Token validation middleware
 */
const oauthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!AUTH_ENABLED) {
    return next();
  }

  console.log(`[OAuth] ${req.method} ${req.path}`);
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.log(`[OAuth] ERROR: No Authorization header present`);
    return res.status(401).json({
      error: "invalid_token",
      error_description: "Missing or invalid Bearer token"
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    console.log(`[OAuth] ERROR: Authorization header doesn't start with 'Bearer ': ${authHeader.substring(0, 20)}...`);
    return res.status(401).json({
      error: "invalid_token",
      error_description: "Missing or invalid Bearer token"
    });
  }

  const token = authHeader.substring(7);
  console.log(`[OAuth] Token received (first 20 chars): ${token.substring(0, 20)}...`);

  try {
    const decoded = jwt.verify(token, OAUTH_TOKEN_SECRET);
    console.log(`[OAuth] Token validated successfully for client: ${(decoded as any).client_id}`);
    // Attach decoded token to request for later use
    (req as any).oauth = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log(`[OAuth] ERROR: Token has expired`);
      return res.status(401).json({
        error: "invalid_token",
        error_description: "Token has expired"
      });
    }
    console.log(`[OAuth] ERROR: Invalid token - ${error instanceof Error ? error.message : "Unknown error"}`);
    return res.status(401).json({
      error: "invalid_token",
      error_description: "Invalid token"
    });
  }
};

// Health check endpoint (no auth required)
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "xero-mcp-server",
    timestamp: new Date().toISOString(),
  });
});

// Readiness check endpoint
app.get("/ready", (_req: Request, res: Response) => {
  // Check if Xero credentials are configured
  const isReady = !!(
    process.env.XERO_CLIENT_BEARER_TOKEN ||
    (process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET)
  );

  if (isReady) {
    res.json({
      status: "ready",
      oauth_enabled: AUTH_ENABLED
    });
  } else {
    res.status(503).json({
      status: "not ready",
      error: "Xero credentials not configured"
    });
  }
});

/**
 * OAuth 2.0 Authorization Endpoint
 * Implements Authorization Code Flow (RFC 6749 Section 4.1)
 *
 * GET /authorize?response_type=code&client_id=xxx&redirect_uri=yyy&state=zzz
 *
 * Shows authorization page for user to approve access
 */
app.get("/authorize", (req: Request, res: Response) => {
  const { response_type, client_id, redirect_uri, state, scope, code_challenge, code_challenge_method } = req.query;

  // Validate required parameters
  if (response_type !== "code") {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Invalid Request</h1>
          <p>Error: unsupported_response_type</p>
          <p>Only response_type=code is supported</p>
        </body>
      </html>
    `);
  }

  if (!client_id) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Invalid Request</h1>
          <p>Error: invalid_request</p>
          <p>Missing required parameter: client_id</p>
        </body>
      </html>
    `);
  }

  // Validate client exists
  const client = OAUTH_CLIENTS.find(c => c.client_id === client_id);
  if (!client) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Invalid Request</h1>
          <p>Error: invalid_client</p>
          <p>Unknown client_id</p>
        </body>
      </html>
    `);
  }

  // Show authorization page
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authorize ${client.name}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 500px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .card {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            margin-top: 0;
            color: #333;
            font-size: 24px;
          }
          .client-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .permissions {
            margin: 20px 0;
          }
          .permission {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
          }
          .permission:last-child {
            border-bottom: none;
          }
          .actions {
            display: flex;
            gap: 10px;
            margin-top: 30px;
          }
          button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            font-weight: 500;
          }
          .approve {
            background: #0066cc;
            color: white;
          }
          .approve:hover {
            background: #0052a3;
          }
          .deny {
            background: #e0e0e0;
            color: #333;
          }
          .deny:hover {
            background: #d0d0d0;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Authorize Access</h1>
          <div class="client-info">
            <strong>${client.name}</strong> is requesting access to your Xero MCP Server
          </div>
          <div class="permissions">
            <h3>This application will be able to:</h3>
            <div class="permission">✓ Access Xero accounting data via MCP protocol</div>
            <div class="permission">✓ Execute tools and queries on your behalf</div>
          </div>
          <form method="POST" action="/authorize">
            <input type="hidden" name="client_id" value="${client_id}" />
            <input type="hidden" name="redirect_uri" value="${redirect_uri || ''}" />
            <input type="hidden" name="state" value="${state || ''}" />
            <input type="hidden" name="scope" value="${scope || ''}" />
            <input type="hidden" name="code_challenge" value="${code_challenge || ''}" />
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method || ''}" />
            <div class="actions">
              <button type="button" class="deny" onclick="window.history.back()">Deny</button>
              <button type="submit" class="approve" name="approved" value="true">Approve</button>
            </div>
          </form>
        </div>
      </body>
    </html>
  `);
});

/**
 * OAuth 2.0 Authorization Approval Handler
 * POST /authorize
 *
 * Handles user consent and generates authorization code
 */
app.post("/authorize", (req: Request, res: Response) => {
  const { client_id, redirect_uri, state, scope, approved, code_challenge, code_challenge_method } = req.body;

  if (!approved) {
    // User denied access
    if (redirect_uri) {
      const url = new URL(redirect_uri);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("error_description", "User denied access");
      if (state) url.searchParams.set("state", state);
      return res.redirect(url.toString());
    }
    return res.status(403).send("Access denied");
  }

  // Validate client
  const client = OAUTH_CLIENTS.find(c => c.client_id === client_id);
  if (!client) {
    return res.status(400).send("Invalid client_id");
  }

  // Generate authorization code
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

  authorizationCodes.set(code, {
    code,
    client_id,
    redirect_uri,
    expires_at: expiresAt,
    scope,
    code_challenge,
    code_challenge_method
  });

  // Redirect back to client with authorization code
  if (redirect_uri) {
    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    const redirectUrl = url.toString();
    console.log(`[OAuth] Redirecting to: ${redirectUrl}`);
    console.log(`[OAuth] Authorization code: ${code}`);
    console.log(`[OAuth] PKCE challenge: ${code_challenge}`);
    console.log(`[OAuth] PKCE method: ${code_challenge_method}`);

    // Use JavaScript redirect to ensure it works in iframe contexts
    // This breaks out of any iframe and redirects at the top level
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Redirecting...</title>
          <script>
            // Break out of iframe if present and redirect at top level
            if (window.top !== window.self) {
              window.top.location.href = "${redirectUrl.replace(/"/g, '\\"')}";
            } else {
              window.location.href = "${redirectUrl.replace(/"/g, '\\"')}";
            }
          </script>
        </head>
        <body>
          <p>Redirecting to Claude.ai...</p>
          <p>If you are not redirected automatically, <a href="${redirectUrl}">click here</a>.</p>
        </body>
      </html>
    `);
  }

  // If no redirect_uri, show the code (for testing)
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Authorization Code</title>
        <style>
          body {
            font-family: monospace;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
          }
          .code {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <h1>Authorization Code</h1>
        <p>Use this code to exchange for an access token:</p>
        <div class="code">${code}</div>
        <p><small>This code expires in 10 minutes</small></p>
      </body>
    </html>
  `);
});

/**
 * OAuth 2.0 Token Handler (shared between /oauth/token and /token endpoints)
 */
const handleTokenRequest = (req: Request, res: Response) => {
  const { grant_type } = req.body;

  // Validate grant_type
  if (grant_type !== "client_credentials" && grant_type !== "authorization_code") {
    return res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Only client_credentials and authorization_code grant types are supported"
    });
  }

  // Handle Authorization Code Grant
  if (grant_type === "authorization_code") {
    const { code, redirect_uri, client_id, client_secret, code_verifier } = req.body;

    console.log(`[Token] Authorization code exchange request`);
    console.log(`[Token] Code: ${code?.substring(0, 16)}...`);
    console.log(`[Token] Redirect URI: ${redirect_uri}`);
    console.log(`[Token] Client ID from body: ${client_id}`);
    console.log(`[Token] Code verifier present: ${!!code_verifier}`);

    if (!code) {
      console.log(`[Token] ERROR: Missing authorization code`);
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameter: code"
      });
    }

    // Extract client credentials
    const credentials = extractClientCredentials(req);
    const effectiveClientId = client_id || credentials.client_id;
    const effectiveClientSecret = client_secret || credentials.client_secret;

    console.log(`[Token] Effective client ID: ${effectiveClientId}`);
    console.log(`[Token] Client secret present: ${!!effectiveClientSecret}`);

    if (!effectiveClientId || !effectiveClientSecret) {
      console.log(`[Token] ERROR: Missing client credentials`);
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing client_id or client_secret"
      });
    }

    // Validate client
    if (!validateClient(effectiveClientId, effectiveClientSecret)) {
      console.log(`[Token] ERROR: Client validation failed for ${effectiveClientId}`);
      return res.status(401).json({
        error: "invalid_client",
        error_description: "Invalid client credentials"
      });
    }

    console.log(`[Token] Client validated successfully`);

    // Retrieve and validate authorization code
    const authCode = authorizationCodes.get(code);
    if (!authCode) {
      console.log(`[Token] ERROR: Authorization code not found or expired`);
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code"
      });
    }

    console.log(`[Token] Authorization code found, issued to client: ${authCode.client_id}`);

    // Validate authorization code belongs to this client
    if (authCode.client_id !== effectiveClientId) {
      console.log(`[Token] ERROR: Code belongs to ${authCode.client_id}, not ${effectiveClientId}`);
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Authorization code was issued to a different client"
      });
    }

    // Validate redirect_uri matches (if provided during authorization)
    if (authCode.redirect_uri && redirect_uri !== authCode.redirect_uri) {
      console.log(`[Token] ERROR: Redirect URI mismatch. Expected: ${authCode.redirect_uri}, Got: ${redirect_uri}`);
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "redirect_uri does not match"
      });
    }

    // Check if code is expired
    if (authCode.expires_at < Date.now()) {
      console.log(`[Token] ERROR: Authorization code expired`);
      authorizationCodes.delete(code);
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Authorization code has expired"
      });
    }

    console.log(`[Token] Authorization code validated successfully`);

    // Verify PKCE if code_challenge was provided during authorization
    if (authCode.code_challenge) {
      console.log(`[Token] PKCE verification required (method: ${authCode.code_challenge_method})`);

      if (!code_verifier) {
        console.log(`[Token] ERROR: PKCE code_verifier missing`);
        authorizationCodes.delete(code);
        return res.status(400).json({
          error: "invalid_request",
          error_description: "code_verifier is required for PKCE"
        });
      }

      // Verify code_verifier against code_challenge
      if (authCode.code_challenge_method === "S256") {
        // Compute SHA256 hash of code_verifier and base64url encode it
        const hash = crypto.createHash('sha256').update(code_verifier).digest();
        const computedChallenge = hash.toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');

        console.log(`[Token] Expected challenge: ${authCode.code_challenge.substring(0, 20)}...`);
        console.log(`[Token] Computed challenge: ${computedChallenge.substring(0, 20)}...`);

        if (computedChallenge !== authCode.code_challenge) {
          console.log(`[Token] ERROR: PKCE verification failed`);
          authorizationCodes.delete(code);
          return res.status(400).json({
            error: "invalid_grant",
            error_description: "Invalid code_verifier"
          });
        }

        console.log(`[Token] PKCE verification successful`);
      } else if (authCode.code_challenge_method === "plain") {
        // For plain method, code_verifier should equal code_challenge
        if (code_verifier !== authCode.code_challenge) {
          console.log(`[Token] ERROR: PKCE plain method verification failed`);
          authorizationCodes.delete(code);
          return res.status(400).json({
            error: "invalid_grant",
            error_description: "Invalid code_verifier"
          });
        }
        console.log(`[Token] PKCE plain method verification successful`);
      } else {
        console.log(`[Token] ERROR: Unsupported PKCE method: ${authCode.code_challenge_method}`);
        authorizationCodes.delete(code);
        return res.status(400).json({
          error: "invalid_request",
          error_description: "Unsupported code_challenge_method"
        });
      }
    }

    // Delete authorization code (one-time use)
    console.log(`[Token] Deleting authorization code (one-time use)`);
    authorizationCodes.delete(code);

    // Generate access token (JWT)
    const access_token = jwt.sign(
      {
        client_id: effectiveClientId,
        iat: Math.floor(Date.now() / 1000),
        scope: authCode.scope || "mcp:access"
      },
      OAUTH_TOKEN_SECRET,
      {
        expiresIn: TOKEN_EXPIRY,
        issuer: "xero-mcp-server",
        audience: "mcp-api"
      }
    );

    console.log(`[Token] Successfully generated access token for client: ${effectiveClientId}`);

    // OAuth 2.0 compliant response
    return res.json({
      access_token,
      token_type: "Bearer",
      expires_in: TOKEN_EXPIRY
    });
  }

  // Handle Client Credentials Grant
  // Extract client credentials
  const { client_id, client_secret } = extractClientCredentials(req);

  if (!client_id || !client_secret) {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "Missing client_id or client_secret"
    });
  }

  // Validate client
  if (!validateClient(client_id, client_secret)) {
    return res.status(401).json({
      error: "invalid_client",
      error_description: "Invalid client credentials"
    });
  }

  // Generate access token (JWT)
  const access_token = jwt.sign(
    {
      client_id,
      iat: Math.floor(Date.now() / 1000),
      scope: "mcp:access" // Optional: add scopes if needed
    },
    OAUTH_TOKEN_SECRET,
    {
      expiresIn: TOKEN_EXPIRY,
      issuer: "xero-mcp-server",
      audience: "mcp-api"
    }
  );

  // OAuth 2.0 compliant response
  res.json({
    access_token,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY
  });
};

/**
 * OAuth 2.0 Token Endpoint
 * Implements Client Credentials Grant (RFC 6749 Section 4.4)
 *
 * Request:
 *   POST /oauth/token
 *   Content-Type: application/x-www-form-urlencoded
 *
 *   grant_type=client_credentials
 *   &client_id=xxx
 *   &client_secret=yyy
 *
 * OR with Basic Auth:
 *   Authorization: Basic base64(client_id:client_secret)
 *   Content-Type: application/x-www-form-urlencoded
 *
 *   grant_type=client_credentials
 *
 * Response:
 *   {
 *     "access_token": "...",
 *     "token_type": "Bearer",
 *     "expires_in": 3600
 *   }
 */
app.post("/oauth/token", handleTokenRequest);

// Alias for /token endpoint (for Claude.ai compatibility)
app.post("/token", handleTokenRequest);

/**
 * OAuth 2.0 Token Introspection Endpoint (Optional, for debugging)
 * RFC 7662
 */
app.post("/oauth/introspect", (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.json({ active: false });
  }

  try {
    const decoded = jwt.verify(token, OAUTH_TOKEN_SECRET) as any;
    res.json({
      active: true,
      client_id: decoded.client_id,
      scope: decoded.scope,
      exp: decoded.exp,
      iat: decoded.iat
    });
  } catch (error) {
    res.json({ active: false });
  }
});

// Create MCP server instance
const mcpServer = XeroMcpServer.GetServer();
ToolFactory(mcpServer);

// Session management for multiple concurrent MCP sessions
interface MCPSession {
  transport: StreamableHTTPServerTransport;
  server: any;
  createdAt: number;
  lastAccess: number;
}

const mcpSessions = new Map<string, MCPSession>();

// Clean up stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  for (const [sessionId, session] of mcpSessions.entries()) {
    if (now - session.lastAccess > maxAge) {
      console.log(`[MCP Session] Cleaning up stale session: ${sessionId}`);
      mcpSessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

async function getOrCreateMCPSession(sessionId: string): Promise<MCPSession> {
  let session = mcpSessions.get(sessionId);

  if (!session) {
    console.log(`[MCP Session] Creating new session: ${sessionId}`);

    // Create a new MCP server instance for this session
    const sessionServer = new McpServer({
      name: "Xero MCP Server",
      version: "1.0.0",
      capabilities: {
        tools: {},
      },
    });

    // Register tools with this session's server
    ToolFactory(sessionServer);

    // Create transport for this session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: async (sid) => {
        console.log(`[MCP Session] Transport session initialized: ${sid}`);
      },
      onsessionclosed: async (sid) => {
        console.log(`[MCP Session] Transport session closed: ${sid}`);
      },
      enableJsonResponse: false,
    });

    // Connect the session server to transport
    await sessionServer.connect(transport);

    session = {
      transport,
      server: sessionServer,
      createdAt: Date.now(),
      lastAccess: Date.now(),
    };

    mcpSessions.set(sessionId, session);
    console.log(`[MCP Session] Session created successfully: ${sessionId}`);
  } else {
    session.lastAccess = Date.now();
  }

  return session;
}

console.log("✓ MCP session manager initialized");

/**
 * MCP Endpoint - Protected by OAuth 2.0
 *
 * Supports HEAD, GET, and POST requests for MCP protocol communication
 * All requests must include: Authorization: Bearer {access_token}
 */

// HEAD request - for endpoint discovery
app.head("/mcp", oauthMiddleware, async (req: Request, res: Response) => {
  res.status(200).end();
});

// GET request - returns endpoint information
app.get("/mcp", oauthMiddleware, async (req: Request, res: Response) => {
  res.json({
    protocol: "mcp",
    version: "1.0",
    transport: "streamable-http",
    authenticated: true,
    client_id: (req as any).oauth?.client_id
  });
});

// POST request - handles MCP protocol messages via StreamableHTTPServerTransport
app.post("/mcp", oauthMiddleware, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).oauth?.client_id;
    console.log(`[MCP] Request from client: ${clientId}`);
    console.log(`[MCP] Request body:`, JSON.stringify(req.body).substring(0, 200));

    // Get or create session ID from cookie
    let sessionId = req.cookies?.['mcp-session-id'];

    // If no session cookie, check if this is an initialize request
    const isInitialize = req.body?.method === 'initialize';

    if (!sessionId) {
      if (isInitialize) {
        // Generate new session ID for new chat sessions
        sessionId = crypto.randomBytes(16).toString('hex');
        console.log(`[MCP Session] New session ID generated: ${sessionId}`);

        // Set session cookie (30 day expiry)
        res.cookie('mcp-session-id', sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
      } else {
        console.error(`[MCP Session] ERROR: No session ID for non-initialize request`);
        return res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "No active session - initialize first",
          },
        });
      }
    }

    console.log(`[MCP Session] Using session: ${sessionId}`);

    // Log Xero credentials status
    console.log(`[MCP] Xero credentials loaded: Client ID=${!!process.env.XERO_CLIENT_ID}, Secret=${!!process.env.XERO_CLIENT_SECRET}, Token=${!!process.env.XERO_CLIENT_BEARER_TOKEN}`);

    // Get or create the MCP session
    const mcpSession = await getOrCreateMCPSession(sessionId);

    // Route request to the session's transport
    await mcpSession.transport.handleRequest(req as any, res as any, req.body);

    // Log the response status after handleRequest completes
    console.log(`[MCP] Response status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.error(`[MCP] ERROR: Transport returned error status ${res.statusCode}`);
    } else {
      console.log(`[MCP] Request completed successfully`);
    }
  } catch (error) {
    console.error("[MCP] Error processing MCP request:", error);
    console.error("[MCP] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Xero MCP HTTP Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 OAuth enabled: ${AUTH_ENABLED}`);

  if (AUTH_ENABLED) {
    console.log(`\n📝 OAuth 2.0 Token Endpoint: http://localhost:${PORT}/oauth/token`);
    console.log(`   Grant Type: client_credentials`);
    console.log(`   Configure Claude.ai with:`);
    console.log(`     - Client ID: ${OAUTH_CLIENTS[0].client_id}`);
    console.log(`     - Client Secret: ${OAUTH_CLIENTS[0].client_secret}`);
  } else {
    console.log(`⚠️  Authentication is DISABLED - not recommended for production`);
  }

  console.log(`\n🔧 MCP Endpoint: http://localhost:${PORT}/mcp\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
