import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface InvoiceLineItem {
  description?: string;
  quantity?: number;
  unitAmount?: number;
  accountCode?: string;
  taxType?: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
  discountRate?: number;
  discountAmount?: number;
}

async function createInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum,
  reference: string | undefined,
  date: string | undefined,
  idempotencyKey?: string,
  dueDate?: string,
  status?: Invoice.StatusEnum,
): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const invoice: Invoice = {
    type: type,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    ...(date !== undefined ? { date } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(type === Invoice.TypeEnum.ACCPAY
      ? { invoiceNumber: reference }
      : { reference: reference }),
    ...(status !== undefined ? { status } : {}),
  };

  const response = await xeroClient.accountingApi.createInvoices(
    xeroClient.tenantId,
    {
      invoices: [invoice],
    }, // invoices
    true, //summarizeErrors
    undefined, //unitdp
    idempotencyKey,
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
  idempotencyKey?: string,
  dueDate?: string,
  status?: Invoice.StatusEnum,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const hasDiscount = lineItems.some(
      (lineItem) => lineItem.discountRate !== undefined || lineItem.discountAmount !== undefined,
    );
    if (hasDiscount && type !== Invoice.TypeEnum.ACCREC) {
      return {
        result: null,
        isError: true,
        error: "Line discounts are only supported on ACCREC sales invoices.",
      };
    }

    const createdInvoice = await createInvoice(
      contactId,
      lineItems,
      type,
      reference,
      date,
      idempotencyKey,
      dueDate,
      status,
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
