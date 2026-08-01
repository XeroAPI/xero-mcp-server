import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { formatError } from "../format-error.js";

function makeAxiosError(status: number, detail?: string): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers };
  const err = new AxiosError(
    "Request failed",
    String(status),
    config as never,
    null,
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
  });

  // xero-node v13 routes requests through axios, which throws on non-2xx. The
  // generated API methods catch that and `reject(JSON.stringify(generateError()))`,
  // so real-world SDK failures arrive as a JSON *string*, not an object.
  describe("xero-node v13 stringified SDK error", () => {
    function makeSerialisedSdkError(statusCode: number, body: unknown): string {
      return JSON.stringify({
        response: {
          statusCode,
          body,
          headers: { "set-cookie": "ak_bmsc=secret" },
          request: {
            url: { protocol: "https:", host: "api.xero.com", path: "/api.xro/2.0/ManualJournals" },
            headers: { authorization: "Bearer eyJSECRET", "user-agent": "xero-mcp" },
            method: "POST",
          },
        },
        body,
      });
    }

    it("surfaces Xero validation errors instead of the generic message", () => {
      const serialised = makeSerialisedSdkError(400, {
        ErrorNumber: 10,
        Type: "ValidationException",
        Message: "A validation exception occurred",
        Elements: [
          {
            ValidationErrors: [
              { Message: "Account code 'ABC' is not a valid code for this organisation." },
            ],
          },
        ],
      });

      const result = formatError(serialised);

      expect(result).toContain("400");
      expect(result).toContain(
        "Account code 'ABC' is not a valid code for this organisation.",
      );
      expect(result).not.toContain("Bearer");
      expect(result).not.toContain("eyJSECRET");
      expect(result).not.toContain("set-cookie");
    });

    it("joins multiple validation errors across elements", () => {
      const serialised = makeSerialisedSdkError(400, {
        Type: "ValidationException",
        Message: "A validation exception occurred",
        Elements: [
          { ValidationErrors: [{ Message: "Journal must balance." }] },
          { ValidationErrors: [{ Message: "Date is invalid." }] },
        ],
      });

      const result = formatError(serialised);

      expect(result).toContain("Journal must balance.");
      expect(result).toContain("Date is invalid.");
    });

    it("maps a stringified 401 to the standard auth message", () => {
      const serialised = makeSerialisedSdkError(401, {});

      const result = formatError(serialised);

      expect(result).toBe(
        "Authentication failed. Please check your Xero credentials.",
      );
      expect(result).not.toContain("Bearer");
    });

    it("maps a stringified 403 to the permission message", () => {
      const result = formatError(makeSerialisedSdkError(403, {}));

      expect(result).toBe(
        "You don't have permission to access this resource in Xero.",
      );
      expect(result).not.toContain("Bearer");
    });

    it("falls back to the top-level Message when no ValidationErrors are present", () => {
      const serialised = makeSerialisedSdkError(400, {
        Type: "ValidationException",
        Message: "A validation exception occurred",
      });

      expect(formatError(serialised)).toContain(
        "A validation exception occurred",
      );
    });

    it("never echoes a JSON string it cannot whitelist", () => {
      const leaky = JSON.stringify({
        request: { headers: { authorization: "Bearer LEAKY_TOKEN" } },
      });

      const result = formatError(leaky);

      expect(result).toBe(
        "An unexpected error occurred while communicating with Xero.",
      );
      expect(result).not.toContain("Bearer");
      expect(result).not.toContain("LEAKY_TOKEN");
    });
  });

  describe("plain Error", () => {
    it("returns the error message", () => {
      expect(formatError(new Error("Employee ID is required"))).toBe(
        "Employee ID is required",
      );
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

    it("handles null safely", () => {
      expect(formatError(null)).toBe(
        "An unexpected error occurred while communicating with Xero.",
      );
    });
  });
});
