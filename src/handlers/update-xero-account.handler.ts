import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account, Accounts, AccountType, CurrencyCode } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function updateAccount(
  accountId: string,
  name?: string,
  code?: string,
  type?: AccountType,
  description?: string,
  taxType?: string,
  currencyCode?: string,
  enablePaymentsToAccount?: boolean,
  showInExpenseClaims?: boolean,
  reportingCode?: string,
  reportingCodeName?: string,
  addToWatchlist?: boolean,
): Promise<Account | undefined> {
  await xeroClient.authenticate();

  const account: Account = {
    name,
    code,
    type,
    description,
    taxType,
    currencyCode: currencyCode as unknown as CurrencyCode,
    enablePaymentsToAccount,
    showInExpenseClaims,
    reportingCode,
    reportingCodeName,
    addToWatchlist,
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

export async function updateXeroAccount(
  accountId: string,
  name?: string,
  code?: string,
  type?: AccountType,
  description?: string,
  taxType?: string,
  currencyCode?: string,
  enablePaymentsToAccount?: boolean,
  showInExpenseClaims?: boolean,
  reportingCode?: string,
  reportingCodeName?: string,
  addToWatchlist?: boolean,
): Promise<XeroClientResponse<Account>> {
  try {
    const updatedAccount = await updateAccount(
      accountId,
      name,
      code,
      type,
      description,
      taxType,
      currencyCode,
      enablePaymentsToAccount,
      showInExpenseClaims,
      reportingCode,
      reportingCodeName,
      addToWatchlist,
    );

    if (!updatedAccount) {
      throw new Error("Account update failed.");
    }

    return {
      result: updatedAccount,
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
