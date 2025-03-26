import { z } from "zod";
import { createXeroCreditNote } from "../handlers/create-xero-credit-note.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "create-credit-note";
const toolDescription = "Create a credit note in Xero.";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const toolSchema = {
  contactId: z.string(),
  lineItems: z.array(lineItemSchema),
  reference: z.string().optional(),
};

const toolHandler = async (
  {
    contactId,
    lineItems,
    reference,
  }: {
    contactId: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType: string;
    }>;
    reference?: string;
  },
  //_extra: { signal: AbortSignal },
) => {
  const result = await createXeroCreditNote(
    contactId,
    lineItems,
    reference,
  );
  if (result.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating credit note: ${result.error}`,
        },
      ],
    };
  }

  const creditNote = result.result;

  return {
    content: [
      {
        type: "text" as const,
        text: [
          "Credit note created successfully:",
          `ID: ${creditNote?.creditNoteID}`,
          `Contact: ${creditNote?.contact?.name}`,
          `Total: ${creditNote?.total}`,
          `Status: ${creditNote?.status}`,
        ].join("\n"),
      },
    ],
  };
};

export const CreateCreditNoteTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};

export default CreateCreditNoteTool; 