import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { Accounts } from "xero-node";

/**
 * List all accounts from Xero
 */
export async function listXeroAccounts(): Promise<ToolResponse<Accounts>> {
  try {
    await xeroClient.authenticate();

    const { body: accounts } = await xeroClient.accountingApi.getAccounts(
      "", // tenantId (empty string for default)
      undefined, // ifModifiedSince
      undefined, // where
      undefined, // order
      {
        headers: { "user-agent": `xero-mcp-server-${getPackageVersion()}` },
      }, // options
    );

    return {
      result: accounts,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
