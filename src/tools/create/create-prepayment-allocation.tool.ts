import { z } from "zod";
import { createXeroPrepaymentAllocation } from "../../handlers/create-xero-prepayment-allocation.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { allocationLineSchema } from "../../helpers/allocation-schema.js";

const CreatePrepaymentAllocationTool = CreateXeroTool(
  "create-prepayment-allocation",
  `Apply a prepayment to one or more invoices in Xero. Provide the prepayment ID (from
  list-prepayments) and one allocation per target invoice (invoice ID from list-invoices,
  the amount to apply, and the date). The prepayment must have remaining credit; each
  invoice must be AUTHORISED and not fully paid. The total allocated cannot exceed the
  prepayment's remaining credit.`,
  {
    prepaymentId: z
      .string()
      .describe("The ID of the prepayment to allocate. Obtain from the list-prepayments tool."),
    allocations: z
      .array(allocationLineSchema)
      .min(1)
      .describe("One entry per invoice the prepayment is applied to."),
  },
  async ({ prepaymentId, allocations }) => {
    const response = await createXeroPrepaymentAllocation(prepaymentId, allocations);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating prepayment allocation: ${response.error}`,
          },
        ],
      };
    }

    const applied = response.result ?? [];

    return {
      content: [
        {
          type: "text" as const,
          text: `Applied prepayment ${prepaymentId} to ${applied.length} invoice(s):`,
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

export default CreatePrepaymentAllocationTool;
