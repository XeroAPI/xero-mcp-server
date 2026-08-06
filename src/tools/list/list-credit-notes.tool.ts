import { z } from "zod";
import { listXeroCreditNotes } from "../../handlers/list-xero-credit-notes.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { LineItem } from "xero-node";

const formatCreditNoteLineItem = (lineItem: LineItem, index: number): string => {
  const tracking = lineItem.tracking
    ?.flatMap((entry) => [
      entry.name && entry.option ? `${entry.name}=${entry.option}` : null,
      entry.trackingCategoryID
        ? `Tracking Category ID: ${entry.trackingCategoryID}`
        : null,
      entry.trackingOptionID
        ? `Tracking Option ID: ${entry.trackingOptionID}`
        : null,
    ].filter((value): value is string => value !== null));

  return [
    `Line ${index + 1}:`,
    lineItem.lineItemID ? `Line Item ID: ${lineItem.lineItemID}` : null,
    lineItem.item?.itemID ? `Item ID: ${lineItem.item.itemID}` : null,
    lineItem.itemCode ? `Item Code: ${lineItem.itemCode}` : null,
    lineItem.description ? `Description: ${lineItem.description}` : null,
    lineItem.quantity !== undefined ? `Quantity: ${lineItem.quantity}` : null,
    lineItem.unitAmount !== undefined ? `Unit Amount: ${lineItem.unitAmount}` : null,
    lineItem.accountCode ? `Account Code: ${lineItem.accountCode}` : null,
    lineItem.taxType ? `Tax Type: ${lineItem.taxType}` : null,
    lineItem.taxAmount !== undefined ? `Tax Amount: ${lineItem.taxAmount}` : null,
    tracking?.length ? `Tracking: ${tracking.join(", ")}` : null,
    lineItem.lineAmount !== undefined ? `Line Amount: ${lineItem.lineAmount}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const ListCreditNotesTool = CreateXeroTool(
  "list-credit-notes",
  `List credit notes in Xero. 
  Ask the user if they want to see credit notes for a specific contact,
  or to see all credit notes before running. 
  Ask the user if they want the next page of credit notes after running this tool 
  if 10 credit notes are returned. 
  If they want the next page, call this tool again with the next page number 
  and the contact if one was provided in the previous call.`,
  {
    page: z.number(),
    contactId: z.string().uuid().optional().describe(
      "Optional Xero contact UUID to filter the results.",
    ),
  },
  async ({ page, contactId }) => {
    const response = await listXeroCreditNotes(page, contactId);
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
            creditNote.lineItems?.length
              ? [
                  "Line Items:",
                  creditNote.lineItems.map(formatCreditNoteLineItem).join("\n\n"),
                ].join("\n")
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
