import { z } from "zod";
import { listXeroCreditNotes } from "../../handlers/list-xero-credit-notes.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListCreditNotesTool = CreateXeroTool(
  "list-credit-notes",
  `List credit notes in Xero.
  Ask the user if they want to see credit notes for a specific contact,
  or to see all credit notes before running.
  pageSize defaults to 10 and is capped at 100; raise it when scanning many credit notes in one call.
  If a full page is returned, more may exist — call again with page+1.`,
  {
    page: z.number(),
    contactId: z.string().optional(),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Optional page size (1–100). Defaults to 10."),
  },
  async ({ page, contactId, pageSize }) => {
    const response = await listXeroCreditNotes(page, contactId, pageSize);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing credit notes: ${response.error}`,
          },
        ],
      };
    }

    const creditNotes = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${creditNotes?.length || 0} credit notes:`,
        },
        ...(creditNotes?.map((creditNote) => ({
          type: "text" as const,
          text: [
            `Credit Note ID: ${creditNote.creditNoteID}`,
            `Credit Note Number: ${creditNote.creditNoteNumber}`,
            creditNote.reference ? `Reference: ${creditNote.reference}` : null,
            `Type: ${creditNote.type || "Unknown"}`,
            `Status: ${creditNote.status || "Unknown"}`,
            creditNote.contact
              ? `Contact: ${creditNote.contact.name} (${creditNote.contact.contactID})`
              : null,
            creditNote.date ? `Date: ${creditNote.date}` : null,
            creditNote.lineAmountTypes
              ? `Line Amount Types: ${creditNote.lineAmountTypes}`
              : null,
            creditNote.subTotal ? `Sub Total: ${creditNote.subTotal}` : null,
            creditNote.totalTax ? `Total Tax: ${creditNote.totalTax}` : null,
            `Total: ${creditNote.total || 0}`,
            creditNote.currencyCode
              ? `Currency: ${creditNote.currencyCode}`
              : null,
            creditNote.currencyRate
              ? `Currency Rate: ${creditNote.currencyRate}`
              : null,
            creditNote.updatedDateUTC
              ? `Last Updated: ${creditNote.updatedDateUTC}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListCreditNotesTool;
