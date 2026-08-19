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

/**
 * Xero replays the response cached against an idempotency key for 24 hours.
 * A key reused with a different payload therefore reports the FIRST entity's
 * identifiers back as success while the second mutation is never created, so
 * a caller-supplied key is bound to the payload it was first used with.
 */
const BINDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BINDINGS = 1_000;

interface IdempotencyBinding {
  expiresAt: number;
  payloadHash: string;
}

function hashMutation(action: string, payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ action, payload: canonicalise(payload) }))
    .digest("hex");
}

export class IdempotencyKeyBindingStore {
  private readonly bindings = new Map<string, IdempotencyBinding>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = BINDING_TTL_MS,
    private readonly maxBindings = MAX_BINDINGS,
  ) {}

  bind(action: string, key: string, payload: unknown): void {
    const now = this.now();
    this.prune(now);

    const payloadHash = hashMutation(action, payload);
    const existing = this.bindings.get(key);

    if (existing && existing.payloadHash !== payloadHash) {
      throw new Error(
        "This idempotencyKey was already used for a different mutation. "
          + "Xero replays the first response for 24 hours, so reusing it would "
          + "report success without creating anything. Use a new key.",
      );
    }

    if (!existing) {
      while (this.bindings.size >= this.maxBindings) {
        const oldest = this.bindings.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.bindings.delete(oldest);
      }
    }

    this.bindings.set(key, { expiresAt: now + this.ttlMs, payloadHash });
  }

  private prune(now: number): void {
    for (const [key, binding] of this.bindings) {
      if (binding.expiresAt <= now) this.bindings.delete(key);
    }
  }
}

export const idempotencyKeyBindings = new IdempotencyKeyBindingStore();
