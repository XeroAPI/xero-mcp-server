import { describe, expect, it } from "vitest";
import {
  idempotencyKeySchema,
  resolveIdempotencyKey,
} from "../idempotency-key.js";

describe("idempotency keys", () => {
  it("uses the caller-provided key unchanged", () => {
    expect(
      resolveIdempotencyKey("create-payment", "request-1", "retry-key-123"),
    ).toBe("retry-key-123");
  });

  it("derives the same Xero-safe key for a replay of the same request", () => {
    const first = resolveIdempotencyKey("create-payment", "request-1");
    const replay = resolveIdempotencyKey("create-payment", "request-1");

    expect(replay).toBe(first);
    expect(first).toMatch(/^xero-mcp-[a-f0-9]{64}$/);
    expect(first).toHaveLength(73);
  });

  it("uses distinct generated keys for different tools or requests", () => {
    const payment = resolveIdempotencyKey("create-payment", "request-1");

    expect(resolveIdempotencyKey("create-invoice", "request-1")).not.toBe(
      payment,
    );
    expect(resolveIdempotencyKey("create-payment", "request-2")).not.toBe(
      payment,
    );
  });

  it("namespaces repeated request IDs from different MCP sessions", () => {
    const first = resolveIdempotencyKey(
      "create-payment",
      "request-1",
      undefined,
      "session-a",
    );
    const second = resolveIdempotencyKey(
      "create-payment",
      "request-1",
      undefined,
      "session-b",
    );

    expect(second).not.toBe(first);
  });

  it("accepts only non-blank keys up to Xero's 128-character limit", () => {
    expect(idempotencyKeySchema.safeParse("x".repeat(128)).success).toBe(true);
    expect(idempotencyKeySchema.safeParse("x".repeat(129)).success).toBe(false);
    expect(idempotencyKeySchema.safeParse("   ").success).toBe(false);
  });
});
