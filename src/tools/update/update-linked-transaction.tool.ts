import { z } from "zod";
import { updateXeroLinkedTransaction } from "../../handlers/update-xero-linked-transaction.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const UpdateLinkedTransactionTool = CreateXeroTool(
  "update-linked-transaction",
  `Update a linked transaction (billable expense) in Xero — stage 2 of recharging a cost to a
  customer. Use this to allocate an existing billable expense onto a customer's sales invoice by
  setting the target sales invoice's transaction ID and line item ID (both from list-invoices —
  the line item ID is shown as "Line Item ID"). You can also change the source line item,
  reassign the customer (contact), or change the status. Provide the linked transaction ID (from
  list-linked-transactions) plus only the fields you want to change. Returns the updated linked
  transaction.`,
  {
    linkedTransactionId: z
      .string()
      .describe("The ID of the linked transaction to update. Obtain from list-linked-transactions."),
    targetTransactionId: z
      .string()
      .optional()
      .describe("The ID of the sales invoice (ACCREC) to allocate this expense onto. Obtain from list-invoices."),
    targetLineItemId: z
      .string()
      .optional()
      .describe('The line item ID on the target sales invoice to allocate onto. Shown as "Line Item ID" in list-invoices.'),
    sourceLineItemId: z
      .string()
      .optional()
      .describe("Change the source bill line item this expense came from."),
    contactId: z
      .string()
      .optional()
      .describe("Reassign the customer (contact) the expense is recharged to. Obtain from list-contacts."),
    status: z
      .enum(["APPROVED", "DRAFT", "ONDRAFT", "BILLED", "VOIDED"])
      .optional()
      .describe("Change the status of the linked transaction."),
  },
  async ({
    linkedTransactionId,
    targetTransactionId,
    targetLineItemId,
    sourceLineItemId,
    contactId,
    status,
  }) => {
    const response = await updateXeroLinkedTransaction(
      linkedTransactionId,
      targetTransactionId,
      targetLineItemId,
      sourceLineItemId,
      contactId,
      status,
    );
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating linked transaction: ${response.error}`,
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
            "Linked transaction updated successfully:",
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

export default UpdateLinkedTransactionTool;
