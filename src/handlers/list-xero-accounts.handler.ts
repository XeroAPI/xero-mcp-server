import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { Account } from "xero-node";

async function listAccounts(): Promise<Account[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getAccounts(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    undefined, // where
    undefined, // order
    {
      headers: { "user-agent": `xero-mcp-server-${getPackageVersion()}` },
    },
  );

  const accounts = response.body.accounts ?? [];
  return accounts;
}

/**
 * List all accounts from Xero
 */
export async function listXeroAccounts(): Promise<ToolResponse<Account[]>> {
  try {
    const accounts = await listAccounts();

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
