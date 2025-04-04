import { z } from "zod";
import { createXeroCreditNote } from "../../handlers/create-xero-credit-note.handler.js";
import { ToolDefinition } from "../../types/tool-definition.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const toolName = "create-credit-note";
const toolDescription =
  "Create a credit note in Xero.\
 When a credit note is created, a deep link to the credit note in Xero is returned. \
 This deep link can be used to view the credit note in Xero directly. \
 This link should be displayed to the user.";

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
  const result = await createXeroCreditNote(contactId, lineItems, reference);
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

  const deepLink = creditNote.creditNoteID
    ? await getDeepLink(DeepLinkType.CREDIT_NOTE, creditNote.creditNoteID)
    : null;

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
          deepLink ? `Link to view: ${deepLink}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
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
