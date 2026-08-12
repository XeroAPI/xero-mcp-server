import { describe, expect, it } from "vitest";

import { getClientHeaders } from "../get-client-headers.js";
import { runWithIdempotencyKey } from "../idempotency-key.js";

describe("getClientHeaders", () => {
  it("adds the scoped key only for a mutation request", () => {
    runWithIdempotencyKey("scoped-key", () => {
      expect(getClientHeaders()).not.toHaveProperty(
        "headers.Idempotency-Key",
      );
      expect(getClientHeaders(true)).toHaveProperty(
        "headers.Idempotency-Key",
        "scoped-key",
      );
    });
  });
});
