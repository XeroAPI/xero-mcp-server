import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { BankTransaction, LineAmountTypes } from "xero-node";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ensureBankTransactionSucceeded } from "../helpers/ensure-bank-transaction-succeeded.js";

interface BankTransactionLineItem {
  description?: string;
  quantity?: number;
  unitAmount?: number;
  itemCode?: string;
  accountCode?: string;
  taxType?: string;
}

type BankTransactionType = "RECEIVE" | "SPEND";

async function createBankTransaction(
  type: BankTransactionType,
  bankAccountId: string,
  contactId: string | undefined,
  lineItems: BankTransactionLineItem[],
  reference?: string,
  date?: string,
  isReconciled?: boolean,
  idempotencyKey?: string,
  lineAmountTypes?: LineAmountTypes,
  currencyRate?: number,
): Promise<BankTransaction | undefined> {
  await xeroClient.authenticate();

  const bankTransaction: BankTransaction = {
    type: BankTransaction.TypeEnum[type],
    bankAccount: {
      accountID: bankAccountId
    },
    ...(contactId ? { contact: { contactID: contactId } } : {}),
    lineItems: lineItems,
    ...(date !== undefined ? { date } : {}),
    reference: reference,
    ...(isReconciled !== undefined ? { isReconciled } : {}),
    ...(lineAmountTypes !== undefined ? { lineAmountTypes } : {}),
    ...(currencyRate !== undefined ? { currencyRate } : {}),
    status: BankTransaction.StatusEnum.AUTHORISED
  };

  const response = await xeroClient.accountingApi.createBankTransactions(
    xeroClient.tenantId, // xeroTenantId
    {
      bankTransactions: [bankTransaction]
    }, // bankTransactions
    true, // summarizeErrors
    4, // unitdp
    idempotencyKey,
    getClientHeaders()
  );

  const createdBankTransaction = response.body.bankTransactions?.[0];

  return createdBankTransaction;
}

export async function createXeroBankTransaction(
  type: BankTransactionType,
  bankAccountId: string,
  contactId: string | undefined,
  lineItems: BankTransactionLineItem[],
  reference?: string,
  date?: string,
  isReconciled?: boolean,
  idempotencyKey?: string,
  lineAmountTypes?: LineAmountTypes,
  currencyRate?: number,
): Promise<XeroClientResponse<BankTransaction>> {
  try {
    const createdTransaction = await createBankTransaction(
      type,
      bankAccountId,
      contactId,
      lineItems,
      reference,
      date,
      isReconciled,
      idempotencyKey,
      lineAmountTypes,
      currencyRate,
    );
  
    const successfulBankTransaction = ensureBankTransactionSucceeded(
      createdTransaction,
      "creation",
    );

    return {
      result: successfulBankTransaction,
      isError: false,
      error: null
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error)  
    };
  }
}
