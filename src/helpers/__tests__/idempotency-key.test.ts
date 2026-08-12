import { describe, expect, it } from "vitest";
import {
  getCurrentIdempotencyKey,
  idempotencyKeySchema,
  resolveIdempotencyKey,
  runWithIdempotencyKey,
} from "../idempotency-key.js";

describe("idempotency keys", () => {
  it("uses the caller-provided key unchanged", () => {
    expect(
      resolveIdempotencyKey("create-payment", "request-1", "retry-key-123"),
    ).toBe("retry-key-123");
  });

  it("derives the same Xero-safe key for a replay of the same request", () => {
    const payload = { amount: 42, invoiceId: "invoice-1" };
    const first = resolveIdempotencyKey(
      "create-payment",
      "request-1",
      undefined,
      "session-1",
      payload,
    );
    const replay = resolveIdempotencyKey(
      "create-payment",
      "request-1",
      undefined,
      "session-1",
      payload,
    );

    expect(replay).toBe(first);
    expect(first).toMatch(/^xero-mcp-[a-f0-9]{64}$/);
    expect(first).toHaveLength(73);
  });

  it("uses distinct keys for different payloads under a reused request ID", () => {
    const first = resolveIdempotencyKey(
      "create-payment",
      1,
      undefined,
      "session-1",
      { amount: 42 },
    );
    const second = resolveIdempotencyKey(
      "create-payment",
      1,
      undefined,
      "session-1",
      { amount: 43 },
    );

    expect(second).not.toBe(first);
  });

  it("canonicalises object keys and excludes control fields", () => {
    const first = resolveIdempotencyKey(
      "create-payment",
      1,
      undefined,
      "session-1",
      { amount: 42, invoice: { id: "invoice-1", type: "ACCREC" } },
    );
    const reordered = resolveIdempotencyKey(
      "create-payment",
      1,
      undefined,
      "session-1",
      {
        dryRun: true,
        invoice: { type: "ACCREC", id: "invoice-1" },
        idempotencyKey: "ignored-control",
        amount: 42,
      },
    );

    expect(reordered).toBe(first);
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

  it("scopes a resolved key to the mutation handler", async () => {
    expect(getCurrentIdempotencyKey()).toBeUndefined();

    await runWithIdempotencyKey("scoped-key", async () => {
      await Promise.resolve();
      expect(getCurrentIdempotencyKey()).toBe("scoped-key");
    });

    expect(getCurrentIdempotencyKey()).toBeUndefined();
  });
});
