import { z } from "zod";
import { updateXeroCreditNote } from "../../handlers/update-xero-credit-note.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const trackingSchema = z.object({
  trackingCategoryID: z.string().optional(),
  trackingOptionID: z.string().optional(),
  name: z.string().optional(),
  option: z.string().optional(),
}).refine(
  (tracking) => Boolean(tracking.trackingOptionID) || Boolean(tracking.name && tracking.option),
  {
    message: "Provide a tracking option ID, or both a tracking category name and option.",
    path: ["trackingOptionID"],
  },
);

const lineItemSchema = z.object({
  lineItemId: z.string().min(1).optional().describe(
    "Existing Xero line item ID. Include this to update a line without recreating it.",
  ),
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  itemCode: z.string().optional(),
  accountCode: z.string(),
  taxType: z.string(),
  tracking: z.array(trackingSchema).max(2).optional(),
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
    reference: z.string().optional().describe(
      "Customer credit-note reference, or supplier credit-note number.",
    ),
    date: z.string().optional(),
    dueDate: z.string().optional(),
    contactId: z.string().optional(),
    idempotencyKey: z.string().min(1).max(128).optional().describe(
      "Optional retry key. Reuse the same key when retrying this exact credit-note update to prevent duplicate processing.",
    ),
  },
  async (
    {
      creditNoteId,
      lineItems,
      reference,
      date,
      dueDate,
      contactId,
      idempotencyKey,
    }: {
      creditNoteId: string;
      lineItems?: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        lineItemId?: string;
        itemCode?: string;
        accountCode: string;
        taxType: string;
        tracking?: Array<{
          trackingCategoryID?: string;
          trackingOptionID?: string;
          name?: string;
          option?: string;
        }>;
      }>;
      reference?: string;
      date?: string;
      dueDate?: string;
      contactId?: string;
      idempotencyKey?: string;
    },
  ) => {
    const xeroLineItems = lineItems?.map(({ lineItemId, ...lineItem }) => ({
      ...lineItem,
      ...(lineItemId ? { lineItemID: lineItemId } : {}),
    }));

    const result = await updateXeroCreditNote(
      creditNoteId,
      xeroLineItems,
      reference,
      contactId,
      date,
      dueDate,
      idempotencyKey,
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
            creditNote?.date ? `Date: ${creditNote.date}` : null,
            creditNote?.dueDate ? `Due Date: ${creditNote.dueDate}` : null,
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
