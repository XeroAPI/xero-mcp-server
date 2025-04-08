import { z } from "zod";
import { updateXeroCreditNote } from "../../handlers/update-xero-credit-note.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const UpdateCreditNoteTool = CreateXeroTool(
  "update-credit-note",
  "Update a credit note in Xero. Only works on draft credit notes.\
  All line items must be provided. Any line items not provided will be removed. Including existing line items.\
  Do not modify line items that have not been specified by the user.\
 When a credit note is updated, a deep link to the credit note in Xero is returned.\
 This deep link can be used to view the credit note in Xero directly.\
 This link should be displayed to the user.",
  {
    creditNoteId: z.string(),
    lineItems: z.array(lineItemSchema).optional().describe(
      "All line items must be provided. Any line items not provided will be removed. Including existing line items.\
      Do not modify line items that have not been specified by the user",
    ),
    reference: z.string().optional(),
    date: z.string().optional(),
    contactId: z.string().optional(),
  },
  async (
    {
      creditNoteId,
      lineItems,
      reference,
      date,
      contactId,
    }: {
      creditNoteId: string;
      lineItems?: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        accountCode: string;
        taxType: string;
      }>;
      reference?: string;
      date?: string;
      contactId?: string;
    },
  ) => {
    const result = await updateXeroCreditNote(
      creditNoteId,
      lineItems,
      reference,
      contactId,
      date,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating credit note: ${result.error}`,
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
            "Credit note updated successfully:",
            `ID: ${creditNote?.creditNoteID}`,
            `Contact: ${creditNote?.contact?.name}`,
            `Total: ${creditNote?.total}`,
            `Status: ${creditNote?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ].join("\n"),
        },
      ],
    };
  },
);

export default UpdateCreditNoteTool; 