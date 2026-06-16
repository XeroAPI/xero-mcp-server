import { z } from "zod";
import { createXeroLinkedTransaction } from "../../handlers/create-xero-linked-transaction.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreateLinkedTransactionTool = CreateXeroTool(
  "create-linked-transaction",
  `Create a linked transaction (billable expense) in Xero — stage 1 of recharging a cost to a
  customer. Marks a single line on a source bill (ACCPAY) as billable to a customer so it can
  later be allocated onto their sales invoice. Provide the source bill's transaction ID and the
  specific line item ID to recharge (both from list-invoices — the line item ID is shown as
  "Line Item ID" on each line), plus the customer's contact ID. Optionally also provide the
  target sales invoice's transaction ID and line item ID to create and allocate in one step (only
  if the sales invoice already exists; otherwise allocate later with update-linked-transaction).
  Returns the created linked transaction with its ID.`,
  {
    sourceTransactionId: z
      .string()
      .describe("The ID of the source bill (ACCPAY invoice) the cost came from. Obtain from list-invoices."),
    sourceLineItemId: z
      .string()
      .describe('The line item ID on the source bill to recharge. Shown as "Line Item ID" on the bill\'s line items in list-invoices.'),
    contactId: z
      .string()
      .describe("The ID of the customer (contact) the expense is being recharged to. Obtain from list-contacts."),
    targetTransactionId: z
      .string()
      .optional()
      .describe("Optional: the ID of the sales invoice (ACCREC) to allocate this expense onto. Only if it already exists; otherwise allocate later with update-linked-transaction."),
    targetLineItemId: z
      .string()
      .optional()
      .describe('Optional: the line item ID on the target sales invoice to allocate onto. Shown as "Line Item ID" in list-invoices.'),
  },
  async ({
    sourceTransactionId,
    sourceLineItemId,
    contactId,
    targetTransactionId,
    targetLineItemId,
  }) => {
    const response = await createXeroLinkedTransaction(
      sourceTransactionId,
      sourceLineItemId,
      contactId,
      targetTransactionId,
      targetLineItemId,
    );
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating linked transaction: ${response.error}`,
          },
        ],
      };
    }

    const lt = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Linked transaction created successfully:",
            `Linked Transaction ID: ${lt?.linkedTransactionID}`,
            `Status: ${lt?.status}`,
            `Source Transaction ID: ${lt?.sourceTransactionID}`,
            `Source Line Item ID: ${lt?.sourceLineItemID}`,
            `Contact ID: ${lt?.contactID}`,
            lt?.targetTransactionID ? `Target Transaction ID: ${lt.targetTransactionID}` : null,
            lt?.targetLineItemID ? `Target Line Item ID: ${lt.targetLineItemID}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateLinkedTransactionTool;
