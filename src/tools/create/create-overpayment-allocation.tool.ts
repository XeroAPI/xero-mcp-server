import { z } from "zod";
import { createXeroOverpaymentAllocation } from "../../handlers/create-xero-overpayment-allocation.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { allocationLineSchema } from "../../helpers/allocation-schema.js";

const CreateOverpaymentAllocationTool = CreateXeroTool(
  "create-overpayment-allocation",
  `Apply an overpayment to one or more invoices in Xero. Provide the overpayment ID (from
  list-overpayments) and one allocation per target invoice (invoice ID from list-invoices,
  the amount to apply, and the date). The overpayment must have remaining credit; each
  invoice must be AUTHORISED and not fully paid. The total allocated cannot exceed the
  overpayment's remaining credit.`,
  {
    overpaymentId: z
      .string()
      .describe("The ID of the overpayment to allocate. Obtain from the list-overpayments tool."),
    allocations: z
      .array(allocationLineSchema)
      .min(1)
      .describe("One entry per invoice the overpayment is applied to."),
  },
  async ({ overpaymentId, allocations }) => {
    const response = await createXeroOverpaymentAllocation(overpaymentId, allocations);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating overpayment allocation: ${response.error}`,
          },
        ],
      };
    }

    const applied = response.result ?? [];

    return {
      content: [
        {
          type: "text" as const,
          text: `Applied overpayment ${overpaymentId} to ${applied.length} invoice(s):`,
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

export default CreateOverpaymentAllocationTool;
