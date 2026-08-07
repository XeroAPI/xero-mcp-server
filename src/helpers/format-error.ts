import { AxiosError } from "axios";

interface XeroSdkError {
  response: {
    statusCode: number;
    body?: unknown;
  };
  body?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isXeroSdkError(error: unknown): error is XeroSdkError {
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return false;
  return typeof (response as { statusCode?: unknown }).statusCode === "number";
}

function parseXeroSdkError(error: unknown): XeroSdkError | null {
  if (typeof error !== "string") return null;

  try {
    const parsed: unknown = JSON.parse(error);
    return isXeroSdkError(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getValidationErrorMessages(validationErrors: unknown): string[] {
  if (!Array.isArray(validationErrors)) return [];

  return validationErrors.flatMap((validationError) => {
    if (!isRecord(validationError)) return [];
    const message = getString(validationError.Message);
    return message ? [message] : [];
  });
}

function getValidationErrorDetail(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;

  const messages = getValidationErrorMessages(body.ValidationErrors);
  if (Array.isArray(body.Elements)) {
    for (const element of body.Elements) {
      if (isRecord(element)) {
        messages.push(
          ...getValidationErrorMessages(element.ValidationErrors),
        );
      }
    }
  }

  return messages.length ? messages.join("; ") : undefined;
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

function formatXeroSdkError(error: XeroSdkError): string {
  const status = error.response.statusCode;
  const mapped = formatHttpStatus(status);
  if (mapped) return mapped;

  const body = error.response.body ?? error.body;
  const bodyFields = isRecord(body) ? body : undefined;
  const problem = isRecord(bodyFields?.problem)
    ? bodyFields.problem
    : undefined;
  const title = getString(problem?.title)
    ?? getString(bodyFields?.httpStatusCode)
    ?? getString(bodyFields?.Type)
    ?? "HTTP error";
  const detail = getString(problem?.detail)
    ?? getString(bodyFields?.detail)
    ?? getString(bodyFields?.Detail)
    ?? getValidationErrorDetail(body)
    ?? getString(bodyFields?.Message);
  return detail ? `${status} ${title}: ${detail}` : `${status} ${title}`;
}

/**
 * Format error messages for return to the LLM.
 *
 * Never stringify unknown error values — xero-node may reject with a JSON
 * string containing `request.headers.authorization`. Parse only its expected
 * response shape and whitelist the fields we extract so secrets never reach
 * the response.
 */
export function formatError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const responseBody = error.response?.data;
    const detail = isRecord(responseBody)
      ? getString(responseBody.Detail)
        ?? getString(responseBody.detail)
        ?? getValidationErrorDetail(responseBody)
        ?? getString(responseBody.Message)
      : undefined;

    if (status !== undefined) {
      const mapped = formatHttpStatus(status);
      if (mapped) return mapped;
    }
    return detail || "An error occurred while communicating with Xero.";
  }

  const sdkError = isXeroSdkError(error) ? error : parseXeroSdkError(error);
  if (sdkError) {
    return formatXeroSdkError(sdkError);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while communicating with Xero.";
}
