import { z } from "zod";

import { getXeroBankTransaction } from "../../handlers/get-xero-bank-transaction.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatBankTransaction } from "../../helpers/format-bank-transaction.js";

const GetBankTransactionTool = CreateXeroTool(
  "get-bank-transaction",
  `Retrieve a single bank transaction from Xero by its BankTransactionID.
Returns the full transaction: type, bank account, contact, date, reference, status,
reconciled state, totals, and every line item with its LineItemID, account code, tax type,
amounts and tracking. Use this to check a transaction's current state before and after
editing it with update-bank-transaction. A deep link to the transaction in Xero is included
and should be shown to the user.`,
  {
    bankTransactionId: z
      .string()
      .describe("The BankTransactionID (GUID) of the bank transaction to retrieve."),
  },
  async ({ bankTransactionId }) => {
    const response = await getXeroBankTransaction(bankTransactionId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving bank transaction: ${response.error}`,
          },
        ],
      };
    }

    const bankTransaction = response.result;

    if (!bankTransaction) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No bank transaction found with ID: ${bankTransactionId}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatBankTransaction(bankTransaction, { includeLink: true }),
        },
      ],
    };
  },
);

export default GetBankTransactionTool;
