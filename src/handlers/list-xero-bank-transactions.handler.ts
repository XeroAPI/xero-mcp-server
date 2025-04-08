import { xeroClient } from "../clients/xero-client.js";
import { BankTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

async function getBankTransactions(
  bankAccountId: string | undefined,
  page: number
): Promise<BankTransaction[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getBankTransactions(xeroClient.tenantId,
      undefined, // ifModifiedSince
      bankAccountId ? `BankAccount.AccountID=guid("${bankAccountId}")` : undefined, // where
      "Date DESC", // order
      page, // page
      undefined, // unitdp
      10, // pagesize
      getClientHeaders()
  );

  return response.body.bankTransactions ?? [];
}

export async function listXeroBankTransactions(
  bankAccountId: string | undefined,
  page: number = 1,
): Promise<XeroClientResponse<BankTransaction[]>> {
  try {
    const bankTransactions = await getBankTransactions(bankAccountId, page);

    return {
      result: bankTransactions,
      isError: false,
      error: null
    }
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error)
    }
  }
}