import { Account, AccountType, CurrencyCode } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export type AccountTypeInput = keyof typeof AccountType;
export type BankAccountTypeInput = "BANK" | "CREDITCARD" | "PAYPAL";

export interface CreateAccountInput {
  name: string;
  type: AccountTypeInput;
  code?: string;
  description?: string;
  taxType?: string;
  enablePaymentsToAccount?: boolean;
  showInExpenseClaims?: boolean;
  bankAccountNumber?: string;
  bankAccountType?: BankAccountTypeInput;
  currencyCode?: string;
  addToWatchlist?: boolean;
}

async function createAccount(input: CreateAccountInput): Promise<Account | undefined> {
  await xeroClient.authenticate();

  const account: Account = {
    name: input.name,
    type: AccountType[input.type],
    code: input.code,
    description: input.description,
    taxType: input.taxType,
    enablePaymentsToAccount: input.enablePaymentsToAccount,
    showInExpenseClaims: input.showInExpenseClaims,
    bankAccountNumber: input.bankAccountNumber,
    bankAccountType: input.bankAccountType
      ? Account.BankAccountTypeEnum[input.bankAccountType]
      : undefined,
    currencyCode: input.currencyCode as CurrencyCode | undefined,
    addToWatchlist: input.addToWatchlist,
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
  input: CreateAccountInput,
): Promise<XeroClientResponse<Account>> {
  try {
    if (input.type === "BANK" && !input.bankAccountNumber) {
      throw new Error("A bank account number is required for BANK accounts.");
    }

    const createdAccount = await createAccount(input);

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
