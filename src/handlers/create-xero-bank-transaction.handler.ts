import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { BankTransaction } from "xero-node";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface BankTransactionLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
}

type BankTransactionType = "RECEIVE" | "SPEND";

async function createBankTransaction(
  type: BankTransactionType,
  bankAccountID: string,
  contactID: string,
  lineItems: BankTransactionLineItem[],
  reference?: string
): Promise<BankTransaction | undefined> {
  const bankTransaction: BankTransaction = {
    type: BankTransaction.TypeEnum[type],
    bankAccount: {
      accountID: bankAccountID
    },
    contact: {
      contactID: contactID
    },
    lineItems: lineItems,
    date: new Date().toISOString().split("T")[0], // Today's date
    reference: reference,
    status: BankTransaction.StatusEnum.AUTHORISED
  };

  const response = await xeroClient.accountingApi.createBankTransactions(
    xeroClient.tenantId, // xeroTenantId
    {
      bankTransactions: [bankTransaction]
    }, // bankTransactions
    true, // summarizeErrors
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders()
  );

  const createdBankTransaction = response.body.bankTransactions?.[0];

  return createdBankTransaction;
}

export async function createXeroBankTransaction(
  type: BankTransactionType,
  bankAccountID: string,
  contactID: string,
  lineItems: BankTransactionLineItem[],
  reference?: string
): Promise<XeroClientResponse<BankTransaction>> {
  try {
    const createdTransaction = await createBankTransaction(type, bankAccountID, contactID, lineItems, reference);
  
    if (!createdTransaction) {
      throw new Error("Bank transaction creation failed.");
    }

    return {
      result: createdTransaction,
      isError: false,
      error: null
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error)  
    }
  }
}