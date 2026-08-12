import { getPackageVersion } from "./get-package-version.js";
import { getCurrentIdempotencyKey } from "./idempotency-key.js";

export const getClientHeaders = (includeIdempotencyKey = false) => {
  const idempotencyKey = includeIdempotencyKey
    ? getCurrentIdempotencyKey()
    : undefined;
  return {
    headers: {
      "user-agent": `xero-mcp-server-${getPackageVersion()}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  };
};
