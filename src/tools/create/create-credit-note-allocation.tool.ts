import { z } from "zod";
import { createXeroCreditNoteAllocation } from "../../handlers/create-xero-credit-note-allocation.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { allocationLineSchema } from "../../helpers/allocation-schema.js";

const CreateCreditNoteAllocationTool = CreateXeroTool(
  "create-credit-note-allocation",
  `Apply a credit note to one or more invoices in Xero. Provide the credit note ID (from
  list-credit-notes) and one allocation per target invoice (invoice ID from list-invoices,
  the amount to apply, and the date). The credit note must be AUTHORISED with remaining
  credit; each invoice must be AUTHORISED and not fully paid. The total allocated cannot
  exceed the credit note's remaining credit.`,
  {
    creditNoteId: z
      .string()
      .describe("The ID of the credit note to allocate. Obtain from the list-credit-notes tool."),
    allocations: z
      .array(allocationLineSchema)
      .min(1)
      .describe("One entry per invoice the credit note is applied to."),
  },
  async ({ creditNoteId, allocations }) => {
    const response = await createXeroCreditNoteAllocation(creditNoteId, allocations);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating credit note allocation: ${response.error}`,
          },
        ],
      };
    }

    const applied = response.result ?? [];

    return {
      content: [
        {
          type: "text" as const,
          text: `Applied credit note ${creditNoteId} to ${applied.length} invoice(s):`,
        },
        ...applied.map((allocation) => ({
          type: "text" as const,
          text: [
            `Allocation ID: ${allocation.allocationID ?? "(not returned)"}`,
            `Invoice ID: ${allocation.invoice?.invoiceID ?? "Unknown"}`,
            `Amount: ${allocation.amount}`,
            `Date: ${allocation.date}`,
          ].join("\n"),
        })),
      ],
    };
  },
);

export default CreateCreditNoteAllocationTool;
