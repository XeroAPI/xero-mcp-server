import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { Invoice } from "xero-node";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
}

/**
 * Create a new invoice in Xero
 */
export async function createXeroInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  reference?: string,
): Promise<ToolResponse<Invoice>> {
  try {
    await xeroClient.authenticate();

    const invoice: Invoice = {
      type: Invoice.TypeEnum.ACCREC,
      contact: {
        contactID: contactId,
      },
      lineItems: lineItems,
      date: new Date().toISOString().split("T")[0], // Today's date
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 30 days from now
      reference: reference,
      status: Invoice.StatusEnum.DRAFT,
    };

    const response = await xeroClient.accountingApi.createInvoices(
      "", // tenantId (empty string for default)
      {
        invoices: [invoice],
      }, // invoices
      true, //summarizeErrors
      undefined, //unitdp
      undefined, //idempotencyKey
      {
        headers: { "user-agent": `xero-mcp-server-${getPackageVersion()}` },
      }, // options
    );
    const createdInvoice = response.body.invoices?.[0];

    if (!createdInvoice) {
      throw new Error("Invoice creation failed.");
    }

    return {
      result: createdInvoice,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
