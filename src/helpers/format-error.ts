import { AxiosError } from "axios";

interface XeroSdkError {
  response: {
    statusCode: number;
    body?: unknown;
  };
  body?: unknown;
}

const MAX_ERROR_TEXT_LENGTH = 1_000;
const SECRET_ENVIRONMENT_KEYS = [
  "XERO_CLIENT_SECRET",
  "XERO_CLIENT_BEARER_TOKEN",
  "XERO_ACCESS_TOKEN",
  "XERO_REFRESH_TOKEN",
] as const;

function sanitiseErrorText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  let text = value.replace(
    /\b(authorization|proxy-authorization|cookie|set-cookie)\s*:[^\r\n]*/gi,
    "$1: [REDACTED]",
  );
  text = Array.from(text, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159) ? " " : character;
  }).join("");
  for (const key of SECRET_ENVIRONMENT_KEYS) {
    const secret = process.env[key];
    if (secret && secret.length >= 4) {
      text = text.split(secret).join("[REDACTED]");
    }
  }

  text = text
    .replace(
      /\b(authorization|proxy-authorization)\s*[:=]\s*(?:(?:bearer|basic)\s+)?[^\s,;]+/gi,
      "$1: [REDACTED]",
    )
    .replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(
      /\b(cookie|set-cookie|x-api-key|api[-_]?key|client[-_]?secret|access[-_]?token|refresh[-_]?token|password)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .replace(
      /([?&](?:sig|signature|token|access_token|refresh_token|api_key|key|code|client_secret)=)[^&#\s]*/gi,
      "$1[REDACTED]",
    )
    .replace(/ {2,}/g, " ")
    .trim();

  if (!text) return undefined;
  return text.length <= MAX_ERROR_TEXT_LENGTH
    ? text
    : `${text.slice(0, MAX_ERROR_TEXT_LENGTH - 3)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return sanitiseErrorText(value);
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
    return sanitiseErrorText(error.message)
      ?? "An unexpected error occurred while communicating with Xero.";
  }

  return "An unexpected error occurred while communicating with Xero.";
}
