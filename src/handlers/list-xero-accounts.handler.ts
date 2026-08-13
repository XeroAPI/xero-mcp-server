import { xeroClient } from "../clients/xero-client.js";
import { xeroApiTenantId } from "../clients/tenant-context.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function listAccounts(): Promise<Account[]> {
  const response = await xeroClient.accountingApi.getAccounts(
    xeroApiTenantId(),
    undefined, // ifModifiedSince
    undefined, // where
    undefined, // order
    getClientHeaders(),
  );

  const accounts = response.body.accounts ?? [];
  return accounts;
}

/**
 * List all accounts from Xero
 */
export async function listXeroAccounts(): Promise<
  XeroClientResponse<Account[]>
> {
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
