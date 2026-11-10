import { z } from "zod";
import { deleteXeroCreditNoteAllocation } from "../../handlers/delete-xero-credit-note-allocation.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeleteCreditNoteAllocationTool = CreateXeroTool(
  "delete-credit-note-allocation",
  `Delete (remove) an allocation from a credit note in Xero. Use this to undo applying
  credit to an invoice, for example before editing or re-allocating the credit note.
  The allocated amount is returned to the credit note's remaining credit and the invoice's
  amount due increases accordingly. Obtain the allocation ID from list-credit-notes.`,
  {
    creditNoteId: z
      .string()
      .describe("The ID of the credit note the allocation belongs to."),
    allocationId: z
      .string()
      .describe(
        "The ID of the allocation to delete. Obtain from list-credit-notes.",
      ),
  },
  async ({
    creditNoteId,
    allocationId,
  }: {
    creditNoteId: string;
    allocationId: string;
  }) => {
    const response = await deleteXeroCreditNoteAllocation(
      creditNoteId,
      allocationId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting credit note allocation: ${response.error}`,
          },
        ],
      };
    }

    const allocation = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Credit note allocation deleted successfully.",
            allocation?.amount !== undefined
              ? `Amount returned to credit note: ${allocation.amount}`
              : null,
            allocation?.invoice?.invoiceID
              ? `Was allocated to invoice: ${allocation.invoice.invoiceID}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default DeleteCreditNoteAllocationTool;
