import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroBankTransaction } from "../../handlers/create-xero-bank-transaction.handler.js";
import { bankTransactionDeepLink } from "../../consts/deeplinks.js";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const CreateBankTransactionTool = CreateXeroTool(
  "create-bank-transaction",
  `Create a bank transaction in Xero.
  When a bank transaction is created, a deep link to the bank transaction in Xero is returned.
  This deep link can be used to view the bank transaction in Xero directly.
  This link should be displayed to the user.`,
  {
    type: z.enum(["RECEIVE", "SPEND"]),
    bankAccountId: z.string(),
    contactId: z.string(),
    lineItems: z.array(lineItemSchema),
    reference: z.string().optional(),
    date: z.string()
      .optional()
      .describe("If no date is provided, the date will default to today's date")
  },
  async ({ type, bankAccountId, contactId, lineItems, reference, date }) => {
    const result = await createXeroBankTransaction(type, bankAccountId, contactId, lineItems, reference, date);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating bank transaction: ${result.error}`
          }
        ]
      };
    }

    const bankTransaction = result.result;

    const deepLink = bankTransaction.bankAccount.accountID && bankTransaction.bankTransactionID
      ? bankTransactionDeepLink(bankTransaction.bankAccount.accountID, bankTransaction.bankTransactionID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Bank transaction successfully:",
            `ID: ${bankTransaction?.bankTransactionID}`,
            `Date: ${bankTransaction?.date}`,
            `Contact: ${bankTransaction?.contact?.name}`,
            `Total: ${bankTransaction?.total}`,
            `Status: ${bankTransaction?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null
          ].filter(Boolean).join("\n"),
        },
      ],
    };
  }
);

export default CreateBankTransactionTool;