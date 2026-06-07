import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account, AccountType } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function createAccount(
  name: string,
  code: string,
  type: AccountType,
  description?: string,
  taxType?: string,
  bankAccountNumber?: string,
): Promise<Account | undefined> {
  await xeroClient.authenticate();

  const account: Account = {
    name,
    code,
    type,
    description,
    taxType,
    bankAccountNumber,
  };

  const response = await xeroClient.accountingApi.createAccount(
    xeroClient.tenantId,
    account,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.accounts?.[0];
}

export async function createXeroAccount(
  name: string,
  code: string,
  type: AccountType,
  description?: string,
  taxType?: string,
  bankAccountNumber?: string,
): Promise<XeroClientResponse<Account>> {
  try {
    const createdAccount = await createAccount(
      name,
      code,
      type,
      description,
      taxType,
      bankAccountNumber,
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
