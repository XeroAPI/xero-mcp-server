import { describe, expect, it } from "vitest";
import {
  deriveChildIdempotencyKey,
  getCurrentIdempotencyKey,
  idempotencyKeySchema,
  runWithIdempotencyKey,
} from "../idempotency-key.js";

describe("idempotency keys", () => {
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

  it("derives stable and distinct keys for fan-out items", () => {
    runWithIdempotencyKey("parent-retry-key", () => {
      const first = deriveChildIdempotencyKey("create-option", {
        categoryId: "category-1",
        name: "Alpha",
      });
      const second = deriveChildIdempotencyKey("create-option", {
        categoryId: "category-1",
        name: "Beta",
      });
      const replay = deriveChildIdempotencyKey("create-option", {
        name: "Alpha",
        categoryId: "category-1",
      });

      expect(first).toMatch(/^xero-mcp-child-[a-f0-9]{64}$/);
      expect(first?.length).toBeLessThanOrEqual(128);
      expect(second).not.toBe(first);
      expect(replay).toBe(first);
    });
  });

  it("does not invent a child key outside a parent mutation", () => {
    expect(deriveChildIdempotencyKey("create-option", { name: "Alpha" })).toBe(
      undefined,
    );
  });
});
