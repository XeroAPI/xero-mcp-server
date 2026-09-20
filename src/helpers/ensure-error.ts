import { formatError } from "./format-error.js";

/**
 * Coerce an unknown thrown value into an Error.
 *
 * The message is built by `formatError`, which whitelists the fields it
 * extracts. Never stringify the raw value here: xero-node 13 rejects failed
 * calls with a JSON string (or, on the non-throwing path, a plain object)
 * whose `response.request.headers` holds the raw outbound headers including
 * the caller's Bearer token, and every caller puts `err.message` straight
 * into a tool response returned to the model.
 */
export function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;

  return new Error(formatError(value));
}
