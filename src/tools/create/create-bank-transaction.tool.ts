import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroBankTransaction } from "../../handlers/create-xero-bank-transaction.handler.js";
import { bankTransactionDeepLink } from "../../consts/deeplinks.js";
import { LineAmountTypes } from "xero-node";

const lineItemSchema = z.object({
  description: z.string().min(1).optional(),
  quantity: z.number().optional(),
  unitAmount: z.number().optional(),
  itemCode: z.string().optional(),
  accountCode: z.string().optional(),
  taxType: z.string().optional(),
}).refine((lineItem) => lineItem.description || lineItem.itemCode, {
  message: "A line item requires a description or item code.",
  path: ["description"],
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
    contactId: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1),
    reference: z.string().optional(),
    date: z.string()
      .optional()
      .describe("Optional transaction date (YYYY-MM-DD). When omitted, Xero applies the current date in the organisation's timezone."),
    isReconciled: z.boolean().optional().describe(
      "Optional reconciliation state. Use true only when the transaction should be marked reconciled.",
    ),
    lineAmountTypes: z.enum(["Exclusive", "Inclusive", "NoTax"]).optional().describe(
      "Optional tax treatment for the supplied line amounts.",
    ),
    currencyRate: z.number().finite().positive().optional().describe(
      "Optional exchange rate to Xero's base currency for a non-base-currency bank account.",
    ),
    idempotencyKey: z.string().min(1).max(128).optional().describe(
      "Optional retry key. Reuse the same key when retrying this exact transaction to prevent duplicates.",
    ),
  },
  async ({
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
  }) => {
    const result = await createXeroBankTransaction(
      type,
      bankAccountId,
      contactId,
      lineItems,
      reference,
      date,
      isReconciled,
      idempotencyKey,
      lineAmountTypes ? LineAmountTypes[lineAmountTypes] : undefined,
      currencyRate,
    );

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
            "Bank transaction created successfully:",
            bankTransaction?.bankTransactionID
              ? `ID: ${bankTransaction.bankTransactionID}`
              : null,
            bankTransaction?.date ? `Date: ${bankTransaction.date}` : null,
            bankTransaction?.contact?.name
              ? `Contact: ${bankTransaction.contact.name}`
              : null,
            bankTransaction?.total !== undefined
              ? `Total: ${bankTransaction.total}`
              : null,
            bankTransaction?.status ? `Status: ${bankTransaction.status}` : null,
            bankTransaction?.isReconciled !== undefined
              ? `Reconciliation: ${bankTransaction.isReconciled ? "Reconciled" : "Unreconciled"}`
              : null,
            bankTransaction?.currencyRate !== undefined
              ? `Currency Rate: ${bankTransaction.currencyRate}`
              : null,
            deepLink ? `Link to view: ${deepLink}` : null
          ].filter(Boolean).join("\n"),
        },
      ],
    };
  }
);

export default CreateBankTransactionTool;
