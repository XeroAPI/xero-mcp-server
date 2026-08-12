import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

/** Xero documents a maximum idempotency-key length of 128 characters. */
export const idempotencyKeySchema = z.string().trim().min(1).max(128);

const serverInvocationNamespace = randomUUID();
const CONTROL_FIELDS = new Set([
  "confirmationAction",
  "confirmationToken",
  "dryRun",
  "idempotencyKey",
]);
const currentIdempotencyKey = new AsyncLocalStorage<string>();

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, child]) => !CONTROL_FIELDS.has(key) && child !== undefined,
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalise(child)]),
    );
  }
  return value;
}

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
  payload: unknown = {},
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
        payload: canonicalise(payload),
      }),
    )
    .digest("hex");

  // Xero accepts idempotency keys up to 128 characters. This is 73 chars.
  return `xero-mcp-${digest}`;
}

export function runWithIdempotencyKey<T>(
  key: string,
  callback: () => T,
): T {
  return currentIdempotencyKey.run(key, callback);
}

export function getCurrentIdempotencyKey(): string | undefined {
  return currentIdempotencyKey.getStore();
}
