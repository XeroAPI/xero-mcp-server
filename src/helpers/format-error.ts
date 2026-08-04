import { AxiosError } from "axios";

interface XeroSdkProblem {
  title?: string;
  detail?: string;
  status?: number;
}

interface XeroSdkError {
  response: {
    statusCode: number;
    body?: {
      httpStatusCode?: string;
      problem?: XeroSdkProblem;
      Detail?: string;
      ValidationErrors?: Array<{ Message?: string }>;
      Elements?: Array<{
        ValidationErrors?: Array<{ Message?: string }>;
      }>;
    };
  };
}

function isXeroSdkError(error: unknown): error is XeroSdkError {
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return false;
  return typeof (response as { statusCode?: unknown }).statusCode === "number";
}

function parseStringifiedSdkError(error: string): XeroSdkError | null {
  if (!error.trim().startsWith("{")) return null;

  try {
    const parsed: unknown = JSON.parse(error);
    return isXeroSdkError(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function collectValidationMessages(
  body?: XeroSdkError["response"]["body"],
): string[] {
  if (!body) return [];

  const topLevel = (body.ValidationErrors ?? [])
    .map((item) => item.Message?.trim())
    .filter((message): message is string => Boolean(message));
  const nested = (body.Elements ?? [])
    .flatMap((element) => element.ValidationErrors ?? [])
    .map((item) => item.Message?.trim())
    .filter((message): message is string => Boolean(message));

  return [...new Set([...topLevel, ...nested])];
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
  if (typeof error === "string") {
    const parsedSdkError = parseStringifiedSdkError(error);
    if (parsedSdkError) {
      return formatError(parsedSdkError);
    }
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as XeroSdkError["response"]["body"] | undefined;
    const detail = data?.Detail;
    const validationMessages = collectValidationMessages(data);

    if (status !== undefined) {
      const mapped = formatHttpStatus(status);
      if (mapped) return mapped;
    }
    if (validationMessages.length > 0) return validationMessages.join("; ");
    return detail || "An error occurred while communicating with Xero.";
  }

  if (isXeroSdkError(error)) {
    const status = error.response.statusCode;
    const mapped = formatHttpStatus(status);
    if (mapped) return mapped;

    const body = error.response.body;
    const validationMessages = collectValidationMessages(body);
    if (validationMessages.length > 0) {
      return validationMessages.join("; ");
    }
    const problem = body?.problem;
    const title = problem?.title ?? body?.httpStatusCode ?? "HTTP error";
    const detail = problem?.detail ?? body?.Detail;
    return detail ? `${status} ${title}: ${detail}` : `${status} ${title}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while communicating with Xero.";
}
