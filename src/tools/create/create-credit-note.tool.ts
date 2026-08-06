import { z } from "zod";
import { createXeroCreditNote } from "../../handlers/create-xero-credit-note.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { CreditNote } from "xero-node";

const lineItemSchema = z.object({
  description: z.string().min(1).optional(),
  quantity: z.number().optional(),
  unitAmount: z.number().optional(),
  itemCode: z.string().optional(),
  accountCode: z.string().optional(),
  taxType: z.string().optional(),
}).refine((lineItem) => lineItem.description || lineItem.itemCode, {
  message: "A line item requires a description or item code.",
  path: ["description"],
});

const CreateCreditNoteTool = CreateXeroTool(
  "create-credit-note",
  "Create a credit note in Xero.\
 When a credit note is created, a deep link to the credit note in Xero is returned. \
 This deep link can be used to view the credit note in Xero directly. \
 This link should be displayed to the user.",
  {
    contactId: z.string(),
    lineItems: z.array(lineItemSchema).optional(),
    type: z.enum(["ACCRECCREDIT", "ACCPAYCREDIT"]).optional().describe(
      "The credit note type. ACCRECCREDIT is for customer credit notes and ACCPAYCREDIT is for supplier credit notes. Defaults to ACCRECCREDIT.",
    ),
    reference: z.string().optional().describe(
      "Reference for an ACCRECCREDIT note or the credit note number for an ACCPAYCREDIT note.",
    ),
    date: z.string().optional().describe(
      "Optional issue date (YYYY-MM-DD). When omitted, Xero uses the current date in the organisation's timezone.",
    ),
    dueDate: z.string().optional().describe("Optional due date (YYYY-MM-DD)."),
    status: z.enum(["DRAFT", "AUTHORISED"]).optional().describe(
      "Credit note status. Defaults to DRAFT; AUTHORISED requires at least one line item.",
    ),
    idempotencyKey: z.string().min(1).max(128).optional().describe(
      "Optional retry key. Reuse the same key when retrying this exact credit note to prevent duplicates.",
    ),
  },
  async ({ contactId, lineItems, type, reference, date, dueDate, status, idempotencyKey }) => {
    if (status === "AUTHORISED" && (!lineItems || lineItems.length === 0)) {
      return {
        content: [{
          type: "text" as const,
          text: "Error creating credit note: An authorised credit note requires at least one line item.",
        }],
      };
    }

    const creditNoteType = type === "ACCPAYCREDIT"
      ? CreditNote.TypeEnum.ACCPAYCREDIT
      : CreditNote.TypeEnum.ACCRECCREDIT;
    const creditNoteStatus = status === "AUTHORISED"
      ? CreditNote.StatusEnum.AUTHORISED
      : undefined;
    const result = await createXeroCreditNote(
      contactId,
      lineItems,
      creditNoteType,
      reference,
      creditNoteStatus,
      idempotencyKey,
      date,
      dueDate,
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
            `Type: ${creditNote?.type}`,
            creditNote?.date ? `Date: ${creditNote.date}` : null,
            creditNote?.dueDate ? `Due Date: ${creditNote.dueDate}` : null,
            `Total: ${creditNote?.total}`,
            `Status: ${creditNote?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateCreditNoteTool;
