import { Account } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function deleteAccount(accountId: string): Promise<Account | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.deleteAccount(
    xeroClient.tenantId,
    accountId,
    getClientHeaders(),
  );

  return response.body.accounts?.[0];
}

export async function deleteXeroAccount(
  accountId: string,
): Promise<XeroClientResponse<Account>> {
  try {
    const deletedAccount = await deleteAccount(accountId);

    return {
      result: deletedAccount ?? { accountID: accountId },
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
