import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface InvoiceLineItem {
  lineItemID?: string;
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
  discountRate?: number;
  discountAmount?: number;
}

async function getInvoice(invoiceId: string): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  // First, get the current invoice to check its status
  const response = await xeroClient.accountingApi.getInvoice(
    xeroClient.tenantId,
    invoiceId, // invoiceId
    undefined, // unitdp
    getClientHeaders(), // options
  );

  return response.body.invoices?.[0];
}

async function updateInvoice(
  invoiceId: string,
  lineItems?: InvoiceLineItem[],
  reference?: string,
  dueDate?: string,
  date?: string,
  contactId?: string,
  expectedPaymentDate?: string,
  plannedPaymentDate?: string,
  lineAmountTypes?: Invoice["lineAmountTypes"],
  idempotencyKey?: string,
): Promise<Invoice | undefined> {
  const invoice: Invoice = {
    lineItems: lineItems,
    reference: reference,
    dueDate: dueDate,
    date: date,
    contact: contactId ? { contactID: contactId } : undefined,
    ...(expectedPaymentDate !== undefined ? { expectedPaymentDate } : {}),
    ...(plannedPaymentDate !== undefined ? { plannedPaymentDate } : {}),
    ...(lineAmountTypes !== undefined ? { lineAmountTypes } : {}),
  };

  const response = await xeroClient.accountingApi.updateInvoice(
    xeroClient.tenantId,
    invoiceId, // invoiceId
    {
      invoices: [invoice],
    }, // invoices
    undefined, // unitdp
    idempotencyKey,
    getClientHeaders(), // options
  );

  return response.body.invoices?.[0];
}

/**
 * Update an existing invoice in Xero
 */
export async function updateXeroInvoice(
  invoiceId: string,
  lineItems?: InvoiceLineItem[],
  reference?: string,
  dueDate?: string,
  date?: string,
  contactId?: string,
  expectedPaymentDate?: string,
  plannedPaymentDate?: string,
  idempotencyKey?: string,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const existingInvoice = await getInvoice(invoiceId);

    const invoiceStatus = existingInvoice?.status;

    // Only allow updates to DRAFT invoices
    if (invoiceStatus !== Invoice.StatusEnum.DRAFT) {
      return {
        result: null,
        isError: true,
        error: `Cannot update invoice because it is not a draft. Current status: ${invoiceStatus}`,
      };
    }

    const hasDiscount = lineItems?.some(
      (lineItem) => lineItem.discountRate !== undefined || lineItem.discountAmount !== undefined,
    );
    if (hasDiscount && existingInvoice?.type !== Invoice.TypeEnum.ACCREC) {
      return {
        result: null,
        isError: true,
        error: "Line discounts are only supported on ACCREC sales invoices.",
      };
    }

    if (
      expectedPaymentDate !== undefined
      && existingInvoice?.type !== Invoice.TypeEnum.ACCREC
    ) {
      return {
        result: null,
        isError: true,
        error: "Expected payment dates are only supported on ACCREC sales invoices.",
      };
    }
    if (
      plannedPaymentDate !== undefined
      && existingInvoice?.type !== Invoice.TypeEnum.ACCPAY
    ) {
      return {
        result: null,
        isError: true,
        error: "Planned payment dates are only supported on ACCPAY bills.",
      };
    }

    const updatedInvoice = await updateInvoice(
      invoiceId,
      lineItems,
      reference,
      dueDate,
      date,
      contactId,
      expectedPaymentDate,
      plannedPaymentDate,
      existingInvoice?.lineAmountTypes,
      idempotencyKey,
    );

    if (!updatedInvoice) {
      throw new Error("Invoice update failed.");
    }

    return {
      result: updatedInvoice,
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
