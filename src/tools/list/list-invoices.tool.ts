import { z } from "zod";
import { listXeroInvoices } from "../../handlers/list-xero-invoices.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const ListInvoicesTool = CreateXeroTool(
  "list-invoices",
  `List invoices in Xero with advanced filtering capabilities.

  ⚠️ CRITICAL: To filter by invoice Type, you MUST use the 'where' parameter:
  - Type=="ACCREC": Sales invoices (customer invoices, accounts receivable)
  - Type=="ACCPAY": Bills (purchase invoices, supplier invoices, accounts payable)
  There is NO separate 'type' or 'types' parameter - you MUST use where=Type=="ACCREC" or where=Type=="ACCPAY"

  This tool supports multiple filtering methods:
  1. Simple filters: contactIds, invoiceNumbers, invoiceIds, statuses
  2. Advanced 'where' parameter (REQUIRED for Type, dates, amounts, contact names, complex queries)

  AI AGENT DECISION GUIDE - Which parameter to use:
  - "Type ACCREC" or "sales invoices" → where=Type=="ACCREC"
  - "Type ACCPAY" or "bills" → where=Type=="ACCPAY"
  - "Status authorised" alone → statuses=["AUTHORISED"]
  - "Type ACCREC AND status authorised" → where=Type=="ACCREC" AND Status=="AUTHORISED"
  - Date filtering → where=Date>=DateTime(2024,01,01)
  - Amount filtering → where=AmountDue>1000
  - Contact name → where=Contact.Name=="ABC Ltd"
  - Multiple statuses only → statuses=["AUTHORISED","PAID"]
  - Specific invoice IDs → invoiceIds=["id1","id2"]

  WHEN TO USE THE 'WHERE' PARAMETER (available fields):
  - Type: where=Type=="ACCREC" (sales) or Type=="ACCPAY" (bills)
  - Status: where=Status=="AUTHORISED" (DRAFT, SUBMITTED, DELETED, AUTHORISED, PAID, VOIDED)
  - Contact.Name: where=Contact.Name=="ABC Limited"
  - Date: where=Date>=DateTime(2020,01,01) (supports >, >=, <, <=)
  - DueDate: where=DueDate<DateTime(2024,01,01) (supports >, >=, <, <=)
  - AmountDue: where=AmountDue>=1000 (supports >, >=, <, <=)
  - Reference, InvoiceNumber, Contact.ContactID, etc.

  COMMON QUERY EXAMPLES:
  - "Show sales invoices" → where=Type=="ACCREC"
  - "Show bills" → where=Type=="ACCPAY"
  - "Authorised sales invoices" → where=Type=="ACCREC" AND Status=="AUTHORISED"
  - "Overdue bills" → where=Type=="ACCPAY" AND DueDate<DateTime(2024,12,01) AND Status=="AUTHORISED"
  - "Invoices from January 2024" → where=Date>=DateTime(2024,01,01) AND Date<DateTime(2024,02,01)
  - "Large unpaid invoices" → where=AmountDue>10000 AND Status=="AUTHORISED"

  For filtering by multiple IDs or statuses, prefer using the dedicated array parameters
  (invoiceIds, statuses, contactIds) over the where filter for better performance.

  Ask the user if they want the next page after returning 10 invoices.`,
  {
    page: z.number().optional().describe("Page number for pagination (default: 1)"),
    contactIds: z
      .array(z.string())
      .optional()
      .describe("Filter by contact IDs (comma-separated list for optimal performance)"),
    invoiceNumbers: z
      .array(z.string())
      .optional()
      .describe("Filter by invoice numbers. When provided, line items will also be returned"),
    invoiceIds: z
      .array(z.string())
      .optional()
      .describe("Filter by invoice IDs (comma-separated list for optimal performance)"),
    statuses: z
      .array(z.string())
      .optional()
      .describe(
        "Filter by invoice statuses (comma-separated list). Valid values: DRAFT, SUBMITTED, DELETED, AUTHORISED, PAID, VOIDED",
      ),
    where: z
      .string()
      .optional()
      .describe(
        "REQUIRED for filtering by invoice Type (ACCREC/ACCPAY), dates, amounts, contact names, or complex queries. " +
        "Common patterns: Type==\"ACCREC\" (sales invoices), Type==\"ACCPAY\" (bills), " +
        "Type==\"ACCREC\" AND Status==\"AUTHORISED\", Date>=DateTime(2024,01,01), AmountDue>1000, Contact.Name==\"ABC Ltd\". " +
        "Range operators: >, >=, <, <=. Logical operators: AND, OR",
      ),
    order: z
      .string()
      .optional()
      .describe(
        "Order by field. Optimized fields: InvoiceId, UpdatedDateUTC, Date. Default: 'UpdatedDateUTC DESC'",
      ),
  },
  async (params) => {
    const { page, contactIds, invoiceNumbers, invoiceIds, statuses, where, order } = params;
    const response = await listXeroInvoices({
      page,
      contactIds,
      invoiceNumbers,
      invoiceIds,
      statuses,
      where,
      order,
    });

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing invoices: ${response.error}`,
          },
        ],
      };
    }

    const invoices = response.result;
    const returnLineItems = (invoiceNumbers?.length ?? 0) > 0;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${invoices?.length || 0} invoices:`,
        },
        ...(invoices?.map((invoice) => ({
          type: "text" as const,
          text: [
            `Invoice ID: ${invoice.invoiceID}`,
            `Invoice: ${invoice.invoiceNumber}`,
            invoice.reference ? `Reference: ${invoice.reference}` : null,
            `Type: ${invoice.type || "Unknown"}`,
            `Status: ${invoice.status || "Unknown"}`,
            invoice.contact
              ? `Contact: ${invoice.contact.name} (${invoice.contact.contactID})`
              : null,
            invoice.date ? `Date: ${invoice.date}` : null,
            invoice.dueDate ? `Due Date: ${invoice.dueDate}` : null,
            invoice.lineAmountTypes
              ? `Line Amount Types: ${invoice.lineAmountTypes}`
              : null,
            invoice.subTotal ? `Sub Total: ${invoice.subTotal}` : null,
            invoice.totalTax ? `Total Tax: ${invoice.totalTax}` : null,
            `Total: ${invoice.total || 0}`,
            invoice.totalDiscount
              ? `Total Discount: ${invoice.totalDiscount}`
              : null,
            invoice.currencyCode ? `Currency: ${invoice.currencyCode}` : null,
            invoice.currencyRate
              ? `Currency Rate: ${invoice.currencyRate}`
              : null,
            invoice.updatedDateUTC
              ? `Last Updated: ${invoice.updatedDateUTC}`
              : null,
            invoice.fullyPaidOnDate
              ? `Fully Paid On: ${invoice.fullyPaidOnDate}`
              : null,
            invoice.amountDue ? `Amount Due: ${invoice.amountDue}` : null,
            invoice.amountPaid ? `Amount Paid: ${invoice.amountPaid}` : null,
            invoice.amountCredited
              ? `Amount Credited: ${invoice.amountCredited}`
              : null,
            invoice.hasErrors ? "Has Errors: Yes" : null,
            invoice.isDiscounted ? "Is Discounted: Yes" : null,
            returnLineItems
              ? `Line Items: ${invoice.lineItems?.map(formatLineItem)}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListInvoicesTool;
