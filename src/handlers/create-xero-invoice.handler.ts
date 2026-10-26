import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CurrencyCode, Invoice, LineAmountTypes, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

export interface InvoiceOptions {
  currencyCode?: string;
  lineAmountTypes?: keyof typeof LineAmountTypes;
  dueDate?: string;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

async function createInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum,
  reference: string | undefined,
  date: string | undefined,
  options: InvoiceOptions,
): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const invoiceDate = date || new Date().toISOString().split("T")[0]; // Use provided date or today's date
  const invoice: Invoice = {
    type: type,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    date: invoiceDate,
    dueDate: options.dueDate || addDays(invoiceDate, 30), // 30 days after the invoice date
    ...(options.currencyCode
      ? { currencyCode: CurrencyCode[options.currencyCode as keyof typeof CurrencyCode] }
      : {}),
    ...(options.lineAmountTypes
      ? { lineAmountTypes: LineAmountTypes[options.lineAmountTypes] }
      : {}),
    ...(type === Invoice.TypeEnum.ACCPAY
      ? { invoiceNumber: reference }
      : { reference: reference }),
    status: Invoice.StatusEnum.DRAFT,
  };

  const response = await xeroClient.accountingApi.createInvoices(
    xeroClient.tenantId,
    {
      invoices: [invoice],
    }, // invoices
    true, //summarizeErrors
    undefined, //unitdp
    undefined, //idempotencyKey
    getClientHeaders(),
  );
  const createdInvoice = response.body.invoices?.[0];
  return createdInvoice;
}

/**
 * Create a new invoice in Xero
 */
export async function createXeroInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum = Invoice.TypeEnum.ACCREC,
  reference?: string,
  date?: string,
  options: InvoiceOptions = {},
): Promise<XeroClientResponse<Invoice>> {
  try {
    if (options.currencyCode && !(options.currencyCode in CurrencyCode)) {
      throw new Error(`Unknown currency code: ${options.currencyCode}`);
    }
    const createdInvoice = await createInvoice(
      contactId,
      lineItems,
      type,
      reference,
      date,
      options,
    );

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
