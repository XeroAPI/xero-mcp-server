import { AxiosError } from "axios";

interface XeroValidationError {
  Message?: string;
}

interface XeroElement {
  ValidationErrors?: XeroValidationError[];
}

interface XeroErrorResponse {
  Detail?: string;
  Elements?: XeroElement[];
}

/**
 * Extract validation error messages from Xero API response
 */
function extractValidationErrors(data: XeroErrorResponse): string | null {
  const validationErrors = data?.Elements?.[0]?.ValidationErrors;
  if (validationErrors && validationErrors.length > 0) {
    return validationErrors
      .map((ve) => ve.Message)
      .filter(Boolean)
      .join("; ");
  }
  return null;
}

/**
 * Format error messages in a user-friendly way
 */
export function formatError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as XeroErrorResponse | undefined;
    const detail = data?.Detail;

    switch (status) {
      case 400: {
        const validationMessage = data ? extractValidationErrors(data) : null;
        return validationMessage || detail || "Validation error from Xero. Please check your input.";
      }
      case 401:
        return "Authentication failed. Please check your Xero credentials.";
      case 403:
        return "You don't have permission to access this resource in Xero.";
      case 404:
        return "The requested resource was not found in Xero.";
      case 429:
        return "Too many requests to Xero. Please try again in a moment.";
      default:
        return detail || "An error occurred while communicating with Xero.";
    }
  }
  return error instanceof Error
    ? error.message
    : `An unexpected error occurred: ${error}`;
}
