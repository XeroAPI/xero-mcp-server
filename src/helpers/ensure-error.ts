import { formatError } from "./format-error.js";

export function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;

  return new Error(formatError(value));
}
