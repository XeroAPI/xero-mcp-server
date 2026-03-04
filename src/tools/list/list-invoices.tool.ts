import { z } from "zod";
import { listXeroInvoices } from "../../handlers/list-xero-invoices.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const ListInvoicesTool = CreateXeroTool(
  "list-invoices",
  `List invoices in Xero. Returns up to pageSize results per page (default 100, max 100).

SORTING: Default sort is UpdatedDateUTC DESC (last-modified first). Use orderBy to sort by DueDate, Date, or InvoiceNumber. Use orderDirection for ASC/DESC.

FILTERING: Use status to filter by invoice status. Use type ACCREC for sales invoices or ACCPAY for bills. Use dateFrom/dateTo for date ranges (YYYY-MM-DD).

PAGINATION: If results returned equals pageSize, there may be more pages. Call again with page+1.

AGGREGATE QUERIES: For "latest invoice", "top N by due date", "total outstanding", "how many overdue" — you MUST either use appropriate orderBy/status/dateFrom filters OR paginate ALL pages before answering. Do NOT answer from partial data.

WORKFLOW:
1. Use orderBy + status filters to get the exact data you need
2. For specific contacts, use contactIds (look up IDs via list-contacts first)
3. For specific invoices by number, use invoiceNumbers

COMMON MISTAKES:
- Do NOT pass contactName, search, query, fromDate, toDate, sortBy, limit, or offset — these params do not exist
- Status values are UPPERCASE: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED, DELETED
- Type values: ACCREC (sales/receivable) or ACCPAY (bills/payable)
- Date format is strictly YYYY-MM-DD`,
  {
    page: z
      .number()
      .int()
      .min(1)
      .describe(
        "Page number (1-based). If results equal pageSize, there may be more pages.",
      ),
    contactIds: z.array(z.string()).optional(),
    invoiceNumbers: z
      .array(z.string())
      .optional()
      .describe("If provided, invoice line items will also be returned"),
    orderBy: z
      .enum(["UpdatedDateUTC", "DueDate", "Date", "InvoiceNumber"])
      .optional()
      .describe("Sort field. Default: UpdatedDateUTC"),
    orderDirection: z
      .enum(["ASC", "DESC"])
      .optional()
      .describe("Sort direction. Default: DESC"),
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "VOIDED", "DELETED"])
      .optional()
      .describe("Filter by invoice status"),
    type: z
      .enum(["ACCREC", "ACCPAY"])
      .optional()
      .describe(
        "ACCREC = sales invoices (accounts receivable), ACCPAY = bills (accounts payable)",
      ),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
      .optional()
      .describe("Only invoices on or after this date (YYYY-MM-DD)"),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
      .optional()
      .describe("Only invoices on or before this date (YYYY-MM-DD)"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Results per page (default 100, max 100)"),
  },
  async ({
    page,
    contactIds,
    invoiceNumbers,
    orderBy,
    orderDirection,
    status,
    type,
    dateFrom,
    dateTo,
    pageSize,
  }) => {
    const response = await listXeroInvoices(
      page,
      contactIds,
      invoiceNumbers,
      orderBy,
      orderDirection,
      status,
      type,
      dateFrom,
      dateTo,
      pageSize,
    );
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
    const effectivePageSize = pageSize ?? 100;
    const invoiceCount = invoices?.length ?? 0;

    return {
      content: [
        {
          type: "text" as const,
          text:
            invoiceCount === effectivePageSize
              ? `Found ${invoiceCount} invoices. The number of results equals pageSize (${effectivePageSize}), so there may be more pages.`
              : `Found ${invoiceCount} invoices:`,
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
