import { AxiosError } from "axios";

interface XeroSdkProblem {
  title?: string;
  detail?: string;
  status?: number;
}

interface XeroValidationError {
  Message?: string;
}

interface XeroSdkErrorBody {
  httpStatusCode?: string;
  problem?: XeroSdkProblem;
  Detail?: string;
  /** Present on Xero validation exceptions, e.g. "A validation exception occurred". */
  Message?: string;
  /** Present on Xero validation exceptions, e.g. "ValidationException". */
  Type?: string;
  /** Per-entity validation failures — where the actionable detail actually lives. */
  Elements?: Array<{ ValidationErrors?: XeroValidationError[] }>;
}

interface XeroSdkError {
  response: {
    statusCode: number;
    body?: XeroSdkErrorBody;
  };
}

function isXeroSdkError(error: unknown): error is XeroSdkError {
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return false;
  return typeof (response as { statusCode?: unknown }).statusCode === "number";
}

/**
 * xero-node v13 issues requests through axios, which throws on any non-2xx
 * response. The generated API methods catch that and reject with
 * `JSON.stringify(new ApiError(err).generateError())` — so real SDK failures
 * reach us as a JSON *string*, not an object.
 *
 * That string embeds `response.request.headers.authorization` (the caller's
 * Bearer token), so it must never be echoed back. Parse it and let the same
 * field whitelist below decide what escapes.
 */
function parseSerialisedSdkError(error: string): unknown {
  try {
    return JSON.parse(error);
  } catch {
    return undefined;
  }
}

/** Collect Xero's per-element validation messages, which carry the real reason. */
function extractValidationMessages(body: XeroSdkErrorBody | undefined): string[] {
  if (!Array.isArray(body?.Elements)) return [];

  return body.Elements.flatMap((element) =>
    Array.isArray(element?.ValidationErrors) ? element.ValidationErrors : [],
  )
    .map((validationError) => validationError?.Message)
    .filter((message): message is string => typeof message === "string" && message.length > 0);
}

function formatHttpStatus(status: number): string {
  switch (status) {
    case 401:
      return "Authentication failed. Please check your Xero credentials.";
    case 403:
      return "You don't have permission to access this resource in Xero.";
    case 404:
      return "The requested resource was not found in Xero.";
    case 429:
      return "Too many requests to Xero. Please try again in a moment.";
    default:
      return "";
  }
}

/**
 * Format error messages for return to the LLM.
 *
 * Never stringify unknown error objects — the xero-node SDK rejects with a
 * plain object whose `request.headers.authorization` field contains the
 * caller's Bearer token. Whitelist the fields we extract so secrets never
 * reach the response.
 */
function describeSdkError(error: XeroSdkError): string {
  const status = error.response.statusCode;
  const mapped = formatHttpStatus(status);
  if (mapped) return mapped;

  const body = error.response.body;
  const problem = body?.problem;
  const title =
    problem?.title ?? body?.httpStatusCode ?? body?.Type ?? "HTTP error";

  const validationMessages = extractValidationMessages(body);
  const detail =
    problem?.detail ??
    body?.Detail ??
    (validationMessages.length > 0 ? validationMessages.join("; ") : undefined) ??
    body?.Message;

  return detail ? `${status} ${title}: ${detail}` : `${status} ${title}`;
}

export function formatError(error: unknown): string {
  if (typeof error === "string") {
    const parsed = parseSerialisedSdkError(error);
    // Only a recognised, whitelisted shape may be described. Anything else
    // falls through to the generic message — never echo the raw string.
    if (isXeroSdkError(parsed)) return describeSdkError(parsed);
    return "An unexpected error occurred while communicating with Xero.";
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const detail = error.response?.data?.Detail;

    if (status !== undefined) {
      const mapped = formatHttpStatus(status);
      if (mapped) return mapped;
    }
    return detail || "An error occurred while communicating with Xero.";
  }

  if (isXeroSdkError(error)) {
    return describeSdkError(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while communicating with Xero.";
}
