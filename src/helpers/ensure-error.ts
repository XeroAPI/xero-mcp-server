import { formatError } from "./format-error.js";

export function ensureError(value: unknown): Error {
  return new Error(formatError(value));
}
