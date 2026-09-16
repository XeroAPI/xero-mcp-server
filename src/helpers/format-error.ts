import { AxiosError } from "axios";

interface XeroSdkProblem {
  title?: string;
  detail?: string;
  status?: number;
}

interface XeroValidationError {
  Message?: string;
}

interface XeroSdkError {
  response: {
    statusCode: number;
    body?: {
      httpStatusCode?: string;
      problem?: XeroSdkProblem;
      Detail?: string;
      Message?: string;
      Elements?: Array<{ ValidationErrors?: XeroValidationError[] }>;
      ValidationErrors?: XeroValidationError[];
    };
  };
}

/**
 * Xero reports a rejected document by returning its validation errors rather
 * than a Detail string. Without this the caller is told only that something
 * unexpected happened, which is not enough to act on.
 */
function collectValidationErrors(body: XeroSdkError["response"]["body"]): string {
  const errors = [
    ...(body?.ValidationErrors ?? []),
    ...(body?.Elements ?? []).flatMap((e) => e.ValidationErrors ?? []),
  ];

  return errors
    .map((e) => e.Message)
    .filter((m): m is string => Boolean(m))
    .join("; ");
}

function isXeroSdkError(error: unknown): error is XeroSdkError {
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return false;
  return typeof (response as { statusCode?: unknown }).statusCode === "number";
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
export function formatError(error: unknown): string {
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
    const status = error.response.statusCode;
    const mapped = formatHttpStatus(status);
    if (mapped) return mapped;

    const body = error.response.body;
    const problem = body?.problem;
    const title = problem?.title ?? body?.httpStatusCode ?? "HTTP error";
    const detail =
      problem?.detail ??
      body?.Detail ??
      collectValidationErrors(body) ??
      body?.Message;
    return detail ? `${status} ${title}: ${detail}` : `${status} ${title}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while communicating with Xero.";
}
