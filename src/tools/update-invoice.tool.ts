import { z } from "zod";
import { updateXeroInvoice } from "../handlers/update-xero-invoice.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "update-invoice";
const toolDescription = "Update an invoice in Xero. Only works on draft invoices.";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const toolSchema = {
  invoiceId: z.string(),
  lineItems: z.array(lineItemSchema).optional(),
  reference: z.string().optional(),
  dueDate: z.string().optional(),
};

const toolHandler = async (
  {
    invoiceId,
    lineItems,
    reference,
    dueDate,
  }: {
    invoiceId: string;
    lineItems?: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType: string;
    }>;
    reference?: string;
    dueDate?: string;
  },
  //_extra: { signal: AbortSignal },
) => {
  const result = await updateXeroInvoice(
    invoiceId,
    lineItems,
    reference,
    dueDate,
  );
  if (result.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error updating invoice: ${result.error}`,
        },
      ],
    };
  }

  const invoice = result.result;

  return {
    content: [
      {
        type: "text" as const,
        text: [
          "Invoice updated successfully:",
          `ID: ${invoice?.invoiceID}`,
          `Contact: ${invoice?.contact?.name}`,
          `Total: ${invoice?.total}`,
          `Status: ${invoice?.status}`,
        ].join("\n"),
      },
    ],
  };
};

export const UpdateInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 