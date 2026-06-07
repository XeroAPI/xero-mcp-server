import { z } from "zod";

// One invoice that a credit note / overpayment / prepayment is applied to.
// Shared by all three create-allocation tools. Mirrors the SDK Allocation model
// (only the target invoice id, amount, and date are needed on the request body —
// the source object is identified by the endpoint path param).
export const allocationLineSchema = z.object({
  invoiceId: z
    .string()
    .describe(
      "The ID of the invoice to apply this allocation to. Obtain from the list-invoices tool. The invoice must be AUTHORISED and not fully paid.",
    ),
  amount: z
    .number()
    .positive()
    .describe(
      "The amount to apply to this invoice (must be positive and not exceed the invoice's amount due or the source's remaining balance).",
    ),
  date: z
    .string()
    .describe("The date the allocation is applied, in YYYY-MM-DD format."),
});
