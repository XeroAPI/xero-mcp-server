#!/usr/bin/env node

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ToolFactory } from "./tools/tool-factory.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Authentication configuration
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const API_KEY = process.env.API_KEY;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  credentials: true,
}));
app.use(express.json());

// Authentication middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!AUTH_ENABLED) {
    return next();
  }

  // Check for API key
  const apiKey = req.headers["x-api-key"];
  if (API_KEY && apiKey === API_KEY) {
    return next();
  }

  // Check for JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized - Missing or invalid token" });
  }

  const token = authHeader.substring(7);
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
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
    res.json({ status: "ready" });
  } else {
    res.status(503).json({ status: "not ready", error: "Xero credentials not configured" });
  }
});

// Token generation endpoint (for testing purposes)
app.post("/auth/token", (req: Request, res: Response) => {
  const { username, password } = req.body;

  // In production, validate against a real user database
  const validUsername = process.env.AUTH_USERNAME || "admin";
  const validPassword = process.env.AUTH_PASSWORD || "password";

  if (username === validUsername && password === validPassword) {
    const token = jwt.sign(
      { username, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Create MCP server instance
const mcpServer = XeroMcpServer.GetServer();
ToolFactory(mcpServer);

// MCP Streamable HTTP endpoints
// Note: The actual transport implementation depends on the @modelcontextprotocol/sdk version
// This is a placeholder that will work with the Streamable HTTP protocol

app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
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
  console.log(`Xero MCP HTTP Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`Authentication enabled: ${AUTH_ENABLED}`);
  if (AUTH_ENABLED) {
    console.log(`Use /auth/token to get a JWT token for authentication`);
  }
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
