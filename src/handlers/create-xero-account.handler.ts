import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account, AccountType, CurrencyCode } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function createAccount(
  code: string,
  name: string,
  type: AccountType,
  description?: string,
  taxType?: string,
  enablePaymentsToAccount?: boolean,
  showInExpenseClaims?: boolean,
  bankAccountNumber?: string,
  bankAccountType?: Account.BankAccountTypeEnum,
  currencyCode?: CurrencyCode,
): Promise<Account | undefined> {
  await xeroClient.authenticate();

  const account: Account = {
    code,
    name,
    type,
    description,
    taxType,
    enablePaymentsToAccount,
    showInExpenseClaims,
    bankAccountNumber,
    bankAccountType,
    currencyCode,
  };

  const response = await xeroClient.accountingApi.createAccount(
    xeroClient.tenantId,
    account,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.accounts?.[0];
}

/**
 * Create a new account in Xero
 */
export async function createXeroAccount(
  code: string,
  name: string,
  type: AccountType,
  description?: string,
  taxType?: string,
  enablePaymentsToAccount?: boolean,
  showInExpenseClaims?: boolean,
  bankAccountNumber?: string,
  bankAccountType?: Account.BankAccountTypeEnum,
  currencyCode?: CurrencyCode,
): Promise<XeroClientResponse<Account>> {
  try {
    const createdAccount = await createAccount(
      code,
      name,
      type,
      description,
      taxType,
      enablePaymentsToAccount,
      showInExpenseClaims,
      bankAccountNumber,
      bankAccountType,
      currencyCode,
    );

    if (!createdAccount) {
      throw new Error("Account creation failed.");
    }

    return {
      result: createdAccount,
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
