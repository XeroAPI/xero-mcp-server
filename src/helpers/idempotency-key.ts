import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

/** Xero documents a maximum idempotency-key length of 128 characters. */
export const idempotencyKeySchema = z.string().trim().min(1).max(128);

const serverInvocationNamespace = randomUUID();

/**
 * Resolve the Xero idempotency key for one financial MCP tool invocation.
 *
 * Callers may supply a key to carry across a retry that receives a new MCP
 * request ID. Otherwise, use a stable hash of the tool, JSON-RPC request ID
 * and session. Stdio has no session ID, so it uses a per-server namespace.
 * Replays across a new session or server process must supply a caller key.
 */
export function resolveIdempotencyKey(
  toolName: string,
  requestId: string | number,
  explicitKey?: string,
  sessionId?: string,
): string {
  if (explicitKey) {
    return explicitKey;
  }

  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        toolName,
        requestId,
        sessionId: sessionId ?? serverInvocationNamespace,
      }),
    )
    .digest("hex");

  // Xero accepts idempotency keys up to 128 characters. This is 73 chars.
  return `xero-mcp-${digest}`;
}
