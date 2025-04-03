import { getPackageVersion } from "./get-package-version.js";

export const getClientHeaders = () => {
  return {
    headers: {
      "user-agent": `xero-mcp-server-${getPackageVersion()}`,
    },
  };
};
