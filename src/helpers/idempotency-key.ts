import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

/** Xero documents a maximum idempotency-key length of 128 characters. */
export const idempotencyKeySchema = z.string().trim().min(1).max(128);

const currentIdempotencyKey = new AsyncLocalStorage<string>();

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalise(child)]),
    );
  }
  return value;
}

export function runWithIdempotencyKey<T>(key: string, callback: () => T): T {
  return currentIdempotencyKey.run(key, callback);
}

export function getCurrentIdempotencyKey(): string | undefined {
  return currentIdempotencyKey.getStore();
}

export function deriveChildIdempotencyKey(
  operation: string,
  item: unknown,
): string | undefined {
  const parentKey = getCurrentIdempotencyKey();
  if (!parentKey) return undefined;

  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        parentKey,
        operation,
        item: canonicalise(item),
      }),
    )
    .digest("hex");

  return `xero-mcp-child-${digest}`;
}
