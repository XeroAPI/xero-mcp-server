import { describe, expect, it } from "vitest";
import { ensureError } from "../ensure-error.js";

describe("ensureError", () => {
  it("returns a newly sanitised Error for an existing Error", () => {
    const error = new Error("original message");
    const result = ensureError(error);

    expect(result).not.toBe(error);
    expect(result.message).toBe("original message");
  });

  it("does not stringify an unknown object containing an authorization header", () => {
    const token = "Bearer secret-token";
    const error = ensureError({
      request: { headers: { authorization: token } },
    });

    expect(error.message).not.toContain(token);
    expect(error.message).not.toContain("Bearer");
  });

  it("does not expose an authorization header embedded in a stringified SDK error", () => {
    const token = "Bearer serialized-secret-token";
    const error = ensureError(
      JSON.stringify({
        response: { statusCode: 400, body: { Detail: "Invalid account" } },
        request: { headers: { authorization: token } },
      }),
    );

    expect(error.message).not.toContain(token);
    expect(error.message).not.toContain("Bearer");
  });

  it("keeps allowlisted SDK error details", () => {
    const error = ensureError({
      response: { statusCode: 400, body: { Detail: "Invalid account" } },
      request: { headers: { authorization: "Bearer secret-token" } },
    });

    expect(error.message).toBe("400 HTTP error: Invalid account");
    expect(error.message).not.toContain("secret-token");
  });
});
