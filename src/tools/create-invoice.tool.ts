import { z } from "zod";
import { createXeroInvoice } from "../handlers/create-xero-invoice.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "create-invoice";
const toolDescription = "Create an invoice in Xero.";
const toolSchema = {
  contactId: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
  reference: z.string().optional(),
};

const toolHandler = async (
  {
    contactId,
    description,
    quantity,
    unitAmount,
    accountCode,
    taxType,
    reference,
  }: {
    contactId: string;
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    taxType: string;
    reference?: string;
  },
  //_extra: { signal: AbortSignal },
) => {
  const result = await createXeroInvoice(
    contactId,
    description,
    quantity,
    unitAmount,
    accountCode,
    taxType,
    reference,
  );
  if (result.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating invoice: ${result.error}`,
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
          "Invoice created successfully:",
          `ID: ${invoice?.invoiceID}`,
          `Contact: ${invoice?.contact?.name}`,
          `Total: ${invoice?.total}`,
          `Status: ${invoice?.status}`,
        ].join("\n"),
      },
    ],
  };
};

export const CreateInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
