import { Account, AccountType, Accounts, CurrencyCode } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import type {
  AccountTypeInput,
  BankAccountTypeInput,
} from "./create-xero-account.handler.js";

export type AccountStatusInput = "ACTIVE" | "ARCHIVED";

export interface UpdateAccountInput {
  name?: string;
  code?: string;
  type?: AccountTypeInput;
  status?: AccountStatusInput;
  description?: string;
  taxType?: string;
  enablePaymentsToAccount?: boolean;
  showInExpenseClaims?: boolean;
  bankAccountNumber?: string;
  bankAccountType?: BankAccountTypeInput;
  currencyCode?: string;
  addToWatchlist?: boolean;
}

async function getAccount(accountId: string): Promise<Account | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getAccount(
    xeroClient.tenantId,
    accountId,
    getClientHeaders(),
  );

  return response.body.accounts?.[0];
}

async function postAccount(accountId: string, account: Account): Promise<Account | undefined> {
  const accounts: Accounts = { accounts: [account] };

  const response = await xeroClient.accountingApi.updateAccount(
    xeroClient.tenantId,
    accountId,
    accounts,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.accounts?.[0];
}

function hasDetailChanges(input: UpdateAccountInput): boolean {
  return Object.entries(input).some(
    ([key, value]) => key !== "status" && value !== undefined,
  );
}

function stripUndefined(account: Account): Account {
  return Object.fromEntries(
    Object.entries(account).filter(([, value]) => value !== undefined),
  ) as Account;
}

/**
 * Xero's account update is a partial update, and it rejects fields that are
 * returned on read but not writable for the account's type (for example
 * TaxType, EnablePaymentsToAccount and ShowInExpenseClaims on BANK accounts).
 * Only the fields the caller supplied are sent.
 *
 * Xero also rejects any request that sets Status alongside other fields
 * ("Cannot update account details and STATUS on the same request"), so
 * details and status are sent as separate requests.
 */
async function updateAccount(
  accountId: string,
  existing: Account,
  input: UpdateAccountInput,
): Promise<Account | undefined> {
  let latest: Account | undefined = existing;

  if (hasDetailChanges(input)) {
    const details = stripUndefined({
      accountID: accountId,
      name: input.name,
      code: input.code,
      type: input.type ? AccountType[input.type] : undefined,
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
    });

    latest = await postAccount(accountId, details);
  }

  if (input.status) {
    latest = await postAccount(accountId, {
      accountID: accountId,
      status: Account.StatusEnum[input.status],
    });
  }

  return latest;
}

export async function updateXeroAccount(
  accountId: string,
  input: UpdateAccountInput,
): Promise<XeroClientResponse<Account>> {
  try {
    const existing = await getAccount(accountId);

    if (!existing) {
      throw new Error("Could not find account.");
    }

    const updatedAccount = await updateAccount(accountId, existing, input);

    if (!updatedAccount) {
      throw new Error("Failed to update account.");
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
