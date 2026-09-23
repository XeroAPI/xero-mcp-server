import { AxiosError } from "axios";

interface XeroSdkProblem {
  title?: string;
  detail?: string;
  status?: number;
}

interface XeroValidationElement {
  ValidationErrors?: Array<{ Message?: string }>;
}

interface XeroSdkErrorBody {
  httpStatusCode?: string;
  problem?: XeroSdkProblem;
  Title?: string;
  Detail?: string;
  Type?: string;
  Message?: string;
  Elements?: XeroValidationElement[];
}

interface XeroSdkError {
  response: {
    statusCode: number;
    body?: XeroSdkErrorBody | string;
  };
}

function isXeroSdkError(error: unknown): error is XeroSdkError {
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return false;
  return typeof (response as { statusCode?: unknown }).statusCode === "number";
}

/**
 * The xero-node SDK rejects failed requests with a JSON *string* produced by
 * ApiError.generateError(). Parse it so we can whitelist fields; the raw
 * string contains the request's Authorization header and must never be
 * returned as-is.
 */
function parseStringifiedSdkError(error: unknown): XeroSdkError | null {
  if (typeof error !== "string") return null;
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

function collectValidationMessages(body: XeroSdkErrorBody): string[] {
  const messages: string[] = [];
  for (const element of body.Elements ?? []) {
    for (const validationError of element.ValidationErrors ?? []) {
      if (validationError.Message) messages.push(validationError.Message);
    }
  }
  return messages;
}

function formatSdkError(error: XeroSdkError): string {
  const status = error.response.statusCode;
  const mapped = formatHttpStatus(status);
  if (mapped) return mapped;

  const body =
    typeof error.response.body === "object" && error.response.body !== null
      ? error.response.body
      : undefined;
  const problem = body?.problem;
  const title =
    problem?.title ?? body?.Type ?? body?.Title ?? body?.httpStatusCode ?? "HTTP error";

  const validationMessages = body ? collectValidationMessages(body) : [];
  if (validationMessages.length > 0) {
    return `${status} ${title}: ${validationMessages.join(" ")}`;
  }

  const detail = problem?.detail ?? body?.Detail ?? body?.Message;
  return detail ? `${status} ${title}: ${detail}` : `${status} ${title}`;
}

/**
 * Format error messages for return to the LLM.
 *
 * Never stringify unknown error objects — the xero-node SDK rejects with a
 * payload whose `request.headers.authorization` field contains the caller's
 * Bearer token. Whitelist the fields we extract so secrets never reach the
 * response.
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
    return formatSdkError(error);
  }

  const parsedSdkError = parseStringifiedSdkError(error);
  if (parsedSdkError) {
    return formatSdkError(parsedSdkError);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while communicating with Xero.";
}
