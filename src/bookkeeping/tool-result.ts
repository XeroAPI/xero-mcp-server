import { xeroClient } from "../clients/xero-client.js";
import { BookkeepingError } from "./service.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeForTool(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForTool);
  if (!isObject(value)) return value;
  const result: JsonObject = {};
  const sensitiveKeys = new Set([
    "authorization",
    "access_token",
    "refresh_token",
    "client_secret",
    "bankaccountdetails",
    "taxnumber",
    "employeridentificationnumber",
  ]);
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKeys.has(key.toLowerCase())) continue;
    result[key] = sanitizeForTool(nested);
  }
  return result;
}

export function toolSuccess(result: unknown, extra: JsonObject = {}) {
  const data = sanitizeForTool({
    success: true,
    tenantId: xeroClient.tenantId,
    ...extra,
    result,
  }) as JsonObject;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

export function toolFailure(error: unknown) {
  const bookkeepingError =
    error instanceof BookkeepingError
      ? error
      : new BookkeepingError(
          error instanceof Error ? error.message : "Bookkeeping operation failed.",
          "MCP tool",
        );
  const data = {
    success: false,
    tenantId: xeroClient.tenantId,
    error: {
      message: bookkeepingError.message,
      status: bookkeepingError.status ?? null,
      endpoint: bookkeepingError.endpoint,
      retryable: bookkeepingError.retryable,
      missingScope: bookkeepingError.missingScope ?? null,
      details: sanitizeForTool(bookkeepingError.details) ?? null,
    },
    reviewRequired: bookkeepingError.status === 409 || bookkeepingError.status === 422,
  };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

export async function runTool(work: () => Promise<unknown>) {
  try {
    return toolSuccess(await work());
  } catch (error) {
    return toolFailure(error);
  }
}
