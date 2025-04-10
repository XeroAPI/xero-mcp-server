import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatAgedReportFilter } from "../../helpers/format-aged-report-filter.js";
import { listXeroAgedPayablesByContact } from "../../handlers/list-aged-payables-by-contact.handler.js";

const ListAgedPayablesByContact = CreateXeroTool(
  "list-aged-payables-by-contact",
  `Lists the aged payables in Xero.
  This shows aged payables for a certain contact up to a report date.`,
  {
    contactId: z.string(),
    reportDate: z.string().optional()
      .describe("Optional date to retrieve aged payables in YYYY-MM-DD format. If none is provided, defaults to end of the current month."),
    invoicesFromDate: z.string().optional()
      .describe("Optional from date in YYYY-MM-DD format. If provided, will only show payable invoices after this date for the contact."),
    invoicesToDate: z.string().optional()
      .describe("Optional to date in YYYY-MM-DD format. If provided, will only show payable invoices before this date for the contact."),
  },
  async ({ contactId, reportDate, invoicesFromDate, invoicesToDate }) => {
    const response = await listXeroAgedPayablesByContact(contactId, reportDate, invoicesFromDate, invoicesToDate);
    
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing aged payables by contact: ${response.error}`,
          },
        ],
      };
    }

    const agedPayablesReport = response.result;
    const filter = formatAgedReportFilter(invoicesFromDate, invoicesToDate);

    return {
      content: [
        {
          type: "text" as const,
          text: `Report Name: ${agedPayablesReport.reportName || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Report Date: ${agedPayablesReport.reportDate || "Not specified"}`
        },
        {
          type: "text" as const,
          text: filter ?? "Showing all relevant invoices"
        },
        {
          type: "text" as const,
          text: JSON.stringify(agedPayablesReport.rows, null, 2),
        }
      ],
    };
  }
);

export default ListAgedPayablesByContact;