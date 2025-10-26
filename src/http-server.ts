#!/usr/bin/env node

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ToolFactory } from "./tools/tool-factory.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// OAuth 2.0 Configuration
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";
const OAUTH_TOKEN_SECRET = process.env.OAUTH_TOKEN_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";
const TOKEN_EXPIRY = parseInt(process.env.TOKEN_EXPIRY || "3600"); // 1 hour default

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
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  const hash1 = crypto.createHash('sha256').update(clientSecret).digest();
  const hash2 = crypto.createHash('sha256').update(client.client_secret).digest();

  return crypto.timingSafeEqual(hash1, hash2);
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

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "invalid_token",
      error_description: "Missing or invalid Bearer token"
    });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, OAUTH_TOKEN_SECRET);
    // Attach decoded token to request for later use
    (req as any).oauth = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: "invalid_token",
        error_description: "Token has expired"
      });
    }
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
app.post("/oauth/token", (req: Request, res: Response) => {
  const { grant_type } = req.body;

  // Validate grant_type
  if (grant_type !== "client_credentials") {
    return res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Only client_credentials grant type is supported"
    });
  }

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
});

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

/**
 * MCP Endpoint - Protected by OAuth 2.0
 *
 * All MCP protocol requests must include:
 *   Authorization: Bearer {access_token}
 */
app.post("/mcp", oauthMiddleware, async (req: Request, res: Response) => {
  try {
    // Handle MCP protocol messages
    const { jsonrpc, id, method, params } = req.body;

    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id || null,
        error: { code: -32600, message: "Invalid Request - jsonrpc must be 2.0" },
      });
    }

    // The MCP server will handle the request
    // For now, we'll set up a basic request handler
    // In a full implementation, this would integrate with StreamableHTTPServerTransport

    res.setHeader("Content-Type", "application/json");

    // This is where the MCP server processes the request
    // The actual implementation will be connected via transport layer
    res.json({
      jsonrpc: "2.0",
      id,
      result: {
        message: "MCP endpoint ready. Full transport integration required.",
        authenticated_client: (req as any).oauth?.client_id
      },
    });
  } catch (error) {
    console.error("Error processing MCP request:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body.id || null,
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : "Unknown error",
      },
    });
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
