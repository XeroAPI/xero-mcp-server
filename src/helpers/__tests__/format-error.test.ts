import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { formatError } from "../format-error.js";

const AXIOS_CONFIG_SECRET = "Bearer AXIOS_CONFIG_TOKEN";
const AXIOS_REQUEST_SECRET = "AXIOS_REQUEST_COOKIE";

function makeAxiosError(status: number, detail?: string): AxiosError {
  const headers = new AxiosHeaders({ Authorization: AXIOS_CONFIG_SECRET });
  const config = { headers };
  const err = new AxiosError(
    "Request failed",
    String(status),
    config as never,
    { _header: `Cookie: ${AXIOS_REQUEST_SECRET}` },
    {
      status,
      data: detail ? { Detail: detail } : {},
      statusText: "",
      headers: {},
      config,
    } as never,
  );
  return err;
}

describe("formatError", () => {
  describe("AxiosError mapping", () => {
    it("maps 401 to authentication message", () => {
      expect(formatError(makeAxiosError(401))).toBe(
        "Authentication failed. Please check your Xero credentials.",
      );
    });

    it("maps 403 to permission message", () => {
      expect(formatError(makeAxiosError(403))).toBe(
        "You don't have permission to access this resource in Xero.",
      );
    });

    it("maps 404 to not-found message", () => {
      expect(formatError(makeAxiosError(404))).toBe(
        "The requested resource was not found in Xero.",
      );
    });

    it("maps 429 to rate-limit message", () => {
      expect(formatError(makeAxiosError(429))).toBe(
        "Too many requests to Xero. Please try again in a moment.",
      );
    });

    it("returns response.data.Detail for non-mapped statuses", () => {
      expect(formatError(makeAxiosError(400, "Field is required"))).toBe(
        "Field is required",
      );
    });

    it("returns generic message when no Detail is provided", () => {
      expect(formatError(makeAxiosError(500))).toBe(
        "An error occurred while communicating with Xero.",
      );
    });

    it("sanitises hostile Axios detail text", () => {
      const result = formatError(
        makeAxiosError(
          400,
          "Invalid field\r\nAuthorization: Bearer AXIOS_SECRET\r\n"
            + "Cookie: sid=COOKIE_SECRET; second=ANOTHER_SECRET\r\n"
            + "https://example.test/callback?signature=SIGNED_VALUE&safe=yes",
        ),
      );

      expect(result).toContain("Invalid field");
      expect(result).toContain("safe=yes");
      expect(result).not.toMatch(/[\r\n]/);
      expect(result).not.toContain("AXIOS_SECRET");
      expect(result).not.toContain("COOKIE_SECRET");
      expect(result).not.toContain("ANOTHER_SECRET");
      expect(result).not.toContain("SIGNED_VALUE");
    });

    it("never leaks config.headers or the request from an AxiosError", () => {
      for (const status of [400, 401, 403, 404, 429, 500]) {
        for (const detail of ["Field is required", undefined]) {
          const result = formatError(makeAxiosError(status, detail));

          expect(result).not.toContain("AXIOS_CONFIG_TOKEN");
          expect(result).not.toContain("AXIOS_REQUEST_COOKIE");
          expect(result).not.toContain("Bearer");
        }
      }
    });
  });

  describe("xero-node SDK error shape", () => {
    it("extracts problem.detail and title without leaking request headers", () => {
      const sdkError = {
        response: {
          statusCode: 405,
          body: {
            httpStatusCode: "MethodNotAllowed",
            problem: {
              title: "MethodNotAllowed",
              detail: "Method not allowed for the current customer jurisdiction.",
              status: 405,
            },
          },
          headers: { "set-cookie": "ak_bmsc=secret" },
        },
        request: {
          headers: { authorization: "Bearer eyJSECRET" },
        },
      };

      const result = formatError(sdkError);

      expect(result).toBe(
        "405 MethodNotAllowed: Method not allowed for the current customer jurisdiction.",
      );
      expect(result).not.toContain("Bearer");
      expect(result).not.toContain("eyJSECRET");
      expect(result).not.toContain("set-cookie");
    });

    it("maps 401 SDK error to the standard auth message", () => {
      const sdkError = {
        response: { statusCode: 401, body: {} },
        request: { headers: { authorization: "Bearer leaky" } },
      };

      const result = formatError(sdkError);
      expect(result).toBe(
        "Authentication failed. Please check your Xero credentials.",
      );
      expect(result).not.toContain("Bearer");
    });

    it("falls back to status code + title when detail is missing", () => {
      const sdkError = {
        response: {
          statusCode: 502,
          body: { httpStatusCode: "BadGateway" },
        },
      };

      expect(formatError(sdkError)).toBe("502 BadGateway");
    });

    it("falls back to a generic title when neither problem nor httpStatusCode is present", () => {
      const sdkError = { response: { statusCode: 502 } };
      expect(formatError(sdkError)).toBe("502 HTTP error");
    });

    it("extracts validation messages from the SDK's JSON-string error shape", () => {
      const sdkError = JSON.stringify({
        response: {
          statusCode: 400,
          body: {
            Elements: [{
              ValidationErrors: [
                { Message: "The account code is invalid." },
                { Message: "The tax type is required." },
              ],
            }],
          },
          headers: { "set-cookie": "secret-cookie" },
          request: { headers: { authorization: "Bearer SDK_SECRET" } },
        },
        body: { shouldNotBeRead: "secret-body" },
      });

      const result = formatError(sdkError);

      expect(result).toBe(
        "400 HTTP error: The account code is invalid.; The tax type is required.",
      );
      expect(result).not.toContain("SDK_SECRET");
      expect(result).not.toContain("secret-cookie");
      expect(result).not.toContain("secret-body");
    });

    it("reads top-level SDK validation errors from the safe body fallback", () => {
      const sdkError = JSON.stringify({
        response: { statusCode: 400 },
        body: {
          ValidationErrors: [{ Message: "A contact is required." }],
        },
        request: { headers: { authorization: "Bearer SDK_SECRET" } },
      });

      const result = formatError(sdkError);

      expect(result).toBe("400 HTTP error: A contact is required.");
      expect(result).not.toContain("SDK_SECRET");
    });

    it("uses Xero Type and Message fields when no detailed validation errors are present", () => {
      const sdkError = JSON.stringify({
        response: {
          statusCode: 400,
          body: {
            Type: "ValidationException",
            Message: "A validation exception occurred.",
          },
          request: { headers: { authorization: "Bearer SDK_SECRET" } },
        },
      });

      const result = formatError(sdkError);

      expect(result).toBe("400 ValidationException: A validation exception occurred.");
      expect(result).not.toContain("SDK_SECRET");
    });

    it("prefers actionable nested validation messages over a generic Xero Message", () => {
      const sdkError = {
        response: {
          statusCode: 400,
          body: {
            Type: "ValidationException",
            Message: "A validation exception occurred.",
            Elements: [{
              ValidationErrors: [{ Message: "Account code is invalid." }],
            }],
          },
        },
      };

      expect(formatError(sdkError)).toBe(
        "400 ValidationException: Account code is invalid.",
      );
    });

    it("sanitises every title and nested validation message in a string error", () => {
      process.env.XERO_CLIENT_SECRET = "KNOWN_CLIENT_SECRET";
      const sdkError = JSON.stringify({
        response: {
          statusCode: 400,
          body: {
            Type: "Bad\u0000Title Authorization: Basic QWxhZGRpbjpvcGVu",
            Elements: [{
              ValidationErrors: [{
                Message: "Ordinary validation text; api_key=QUERY_SECRET; KNOWN_CLIENT_SECRET",
              }],
            }],
          },
        },
      });

      try {
        const result = formatError(sdkError);
        expect(result).toContain("Ordinary validation text");
        expect(result).not.toContain("QWxhZGRpbjpvcGVu");
        expect(result).not.toContain("QUERY_SECRET");
        expect(result).not.toContain("KNOWN_CLIENT_SECRET");
        expect(result).not.toContain("\u0000");
      } finally {
        delete process.env.XERO_CLIENT_SECRET;
      }
    });
  });

  describe("returned message length", () => {
    it("bounds a response carrying many validation errors", () => {
      const sdkError = {
        response: {
          statusCode: 400,
          body: {
            Elements: [{
              ValidationErrors: Array.from({ length: 200 }, (_, index) => ({
                Message: `Validation failure number ${index} on a line item.`,
              })),
            }],
          },
        },
      };

      expect(formatError(sdkError).length).toBeLessThanOrEqual(1_000);
    });

    it("bounds a response whose title and detail are both at the cap", () => {
      const sdkError = {
        response: {
          statusCode: 400,
          body: {
            Type: "T".repeat(2_000),
            Detail: "D".repeat(2_000),
          },
        },
      };

      expect(formatError(sdkError).length).toBeLessThanOrEqual(1_000);
    });

    it("bounds an Axios detail that is already at the cap", () => {
      expect(
        formatError(makeAxiosError(400, "A".repeat(2_000))).length,
      ).toBeLessThanOrEqual(1_000);
    });
  });

  describe("plain Error", () => {
    it("returns the error message", () => {
      expect(formatError(new Error("Employee ID is required"))).toBe(
        "Employee ID is required",
      );
    });

    it("sanitises and bounds plain Error messages", () => {
      process.env.XERO_CLIENT_BEARER_TOKEN = "KNOWN_BEARER_SECRET";
      try {
        const result = formatError(
          new Error(
            `Failed\nAuthorization: Bearer INLINE_SECRET KNOWN_BEARER_SECRET ${"x".repeat(2_000)}`,
          ),
        );
        expect(result.length).toBeLessThanOrEqual(1_000);
        expect(result).not.toMatch(/[\r\n]/);
        expect(result).not.toContain("INLINE_SECRET");
        expect(result).not.toContain("KNOWN_BEARER_SECRET");
      } finally {
        delete process.env.XERO_CLIENT_BEARER_TOKEN;
      }
    });
  });

  describe("unknown error shapes", () => {
    it("returns a generic message and never stringifies the object", () => {
      const leakyUnknown = {
        request: { headers: { authorization: "Bearer LEAKY_TOKEN" } },
      };

      const result = formatError(leakyUnknown);

      expect(result).toBe(
        "An unexpected error occurred while communicating with Xero.",
      );
      expect(result).not.toContain("Bearer");
      expect(result).not.toContain("LEAKY_TOKEN");
    });

    it("handles string errors safely", () => {
      expect(formatError("something blew up")).toBe(
        "An unexpected error occurred while communicating with Xero.",
      );
    });

    it("handles malformed JSON SDK error strings safely", () => {
      expect(formatError('{"request":{"headers":{"authorization":"Bearer LEAKY"}}')).toBe(
        "An unexpected error occurred while communicating with Xero.",
      );
    });

    it("handles null safely", () => {
      expect(formatError(null)).toBe(
        "An unexpected error occurred while communicating with Xero.",
      );
    });
  });
});
