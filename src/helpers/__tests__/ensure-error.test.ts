import { describe, it, expect } from "vitest";
import { ensureError } from "../ensure-error.js";

const BEARER = "Bearer eyJhbGciOiJSUzI1NiJ9.super-secret-access-token";

describe("ensureError", () => {
  it("does not leak credentials from a rejected xero-node SDK object", () => {
    const sdkRejection = {
      response: {
        statusCode: 400,
        body: { problem: { title: "Bad Request", detail: "Name is required" } },
      },
      request: {
        headers: {
          authorization: BEARER,
          "xero-tenant-id": "1f2e3d4c-5b6a-7988-9a0b-1c2d3e4f5a6b",
        },
      },
    };

    const message = ensureError(sdkRejection).message;

    expect(message).not.toContain(BEARER);
    expect(message).not.toContain("authorization");
    expect(message).toContain("Bad Request");
  });

  it("does not leak credentials from a xero-node 13 JSON string rejection", () => {
    // xero-node 13.x rejects failed calls with
    // JSON.stringify(new ApiError(err).generateError()), and ApiError copies
    // the raw outbound request headers into request.headers.
    const sdkStringRejection = JSON.stringify({
      response: {
        statusCode: 401,
        body: { Title: "Unauthorized" },
        headers: {},
        request: {
          url: { protocol: "https:", host: "api.xero.com", path: "/api.xro/2.0/Contacts" },
          headers: { authorization: BEARER, "xero-tenant-id": "tenant" },
          method: "POST",
        },
      },
      body: { Title: "Unauthorized" },
    });

    const message = ensureError(sdkStringRejection).message;

    expect(message).not.toContain(BEARER);
    expect(message).not.toContain("authorization");
  });

  it("does not leak credentials from an arbitrary thrown object", () => {
    const message = ensureError({
      headers: { authorization: BEARER },
    }).message;

    expect(message).not.toContain(BEARER);
  });

  it("returns an existing Error unchanged", () => {
    const original = new Error("boom");
    expect(ensureError(original)).toBe(original);
  });

  it("still returns an Error for primitive throws", () => {
    expect(ensureError("plain string")).toBeInstanceOf(Error);
  });
});
