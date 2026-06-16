import { z } from "zod";
import { deleteXeroLinkedTransaction } from "../../handlers/delete-xero-linked-transaction.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeleteLinkedTransactionTool = CreateXeroTool(
  "delete-linked-transaction",
  `Delete a linked transaction (billable expense) in Xero by its ID. Use this to undo a
  billable-expense link created in error. Obtain the ID from list-linked-transactions.`,
  {
    linkedTransactionId: z
      .string()
      .describe("The ID of the linked transaction to delete. Obtain from list-linked-transactions."),
  },
  async ({ linkedTransactionId }: { linkedTransactionId: string }) => {
    const response = await deleteXeroLinkedTransaction(linkedTransactionId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting linked transaction: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully deleted linked transaction with ID: ${linkedTransactionId}`,
        },
      ],
    };
  },
);

export default DeleteLinkedTransactionTool;
