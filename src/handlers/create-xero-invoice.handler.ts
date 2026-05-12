import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CurrencyCode, Invoice, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { postAuditNote } from "../helpers/post-audit-note.js";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

export type InvoiceExtras = {
  brandingThemeID?: string;
  expectedPaymentDate?: string;
  plannedPaymentDate?: string;
  currencyCode?: string;
  currencyRate?: number;
};

export function applyInvoiceExtras(invoice: Invoice, extras: InvoiceExtras): void {
  if (extras.brandingThemeID !== undefined) invoice.brandingThemeID = extras.brandingThemeID;
  if (extras.expectedPaymentDate !== undefined) invoice.expectedPaymentDate = extras.expectedPaymentDate;
  if (extras.plannedPaymentDate !== undefined) invoice.plannedPaymentDate = extras.plannedPaymentDate;
  if (extras.currencyCode !== undefined) {
    const code = extras.currencyCode.toUpperCase() as keyof typeof CurrencyCode;
    if (CurrencyCode[code] !== undefined) invoice.currencyCode = CurrencyCode[code];
  }
  if (extras.currencyRate !== undefined) invoice.currencyRate = extras.currencyRate;
}

async function createInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum,
  reference: string | undefined,
  date: string | undefined,
  dueDate: string | undefined,
  extras: InvoiceExtras | undefined,
): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const invoiceDate = date || new Date().toISOString().split("T")[0];
  const resolvedDueDate =
    dueDate ||
    new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

  const invoice: Invoice = {
    type: type,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    date: invoiceDate,
    dueDate: resolvedDueDate,
    ...(type === Invoice.TypeEnum.ACCPAY
      ? { invoiceNumber: reference }
      : { reference: reference }),
    status: Invoice.StatusEnum.DRAFT,
  };

  if (extras) applyInvoiceExtras(invoice, extras);

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
  dueDate?: string,
  extras?: InvoiceExtras,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const createdInvoice = await createInvoice(
      contactId,
      lineItems,
      type,
      reference,
      date,
      dueDate,
      extras,
    );

    if (!createdInvoice) {
      throw new Error("Invoice creation failed.");
    }

    await postAuditNote("Invoice", createdInvoice.invoiceID, "Created");

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
