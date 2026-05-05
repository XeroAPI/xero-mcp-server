import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account, Accounts } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function archiveAccount(
  accountId: string,
): Promise<Account | undefined> {
  await xeroClient.authenticate();

  const account: Account = {
    status: Account.StatusEnum.ARCHIVED,
  };

  const accounts: Accounts = {
    accounts: [account],
  };

  const response = await xeroClient.accountingApi.updateAccount(
    xeroClient.tenantId,
    accountId,
    accounts,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.accounts?.[0];
}

export async function archiveXeroAccount(
  accountId: string,
): Promise<XeroClientResponse<Account>> {
  try {
    const archivedAccount = await archiveAccount(accountId);

    if (!archivedAccount) {
      throw new Error("Account archival failed.");
    }

    return {
      result: archivedAccount,
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
