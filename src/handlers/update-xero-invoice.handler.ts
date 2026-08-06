import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice, LineItemTracking } from "xero-node";
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
  status?: Invoice.StatusEnum,
): Promise<Invoice | undefined> {
  const invoice: Invoice = {
    lineItems: lineItems,
    reference: reference,
    dueDate: dueDate,
    date: date,
    contact: contactId ? { contactID: contactId } : undefined,
    status: status,
  };

  const response = await xeroClient.accountingApi.updateInvoice(
    xeroClient.tenantId,
    invoiceId, // invoiceId
    {
      invoices: [invoice],
    }, // invoices
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders(), // options
  );

  return response.body.invoices?.[0];
}

function formatAppliedEntityLabels(invoice: Invoice): string[] {
  return [
    invoice.payments?.length ? "payments" : null,
    invoice.creditNotes?.length ? "credit notes" : null,
    invoice.prepayments?.length ? "prepayments" : null,
    invoice.overpayments?.length ? "overpayments" : null,
  ].filter((label) => label !== null);
}

function formatRejectionReason(invoice: Invoice): string | undefined {
  const status = invoice.status;

  const isUpdatableStatus =
    status === Invoice.StatusEnum.DRAFT ||
    status === Invoice.StatusEnum.SUBMITTED ||
    status === Invoice.StatusEnum.AUTHORISED;

  if (!isUpdatableStatus) {
    return `Cannot update invoice because its status is ${status}. Only draft, submitted and authorised invoices can be updated.`;
  }

  const applied = formatAppliedEntityLabels(invoice);

  if (applied.length > 0) {
    return `Cannot update invoice because it has ${applied.join(" and ")} applied to it. Remove them before updating the invoice.`;
  }

  return undefined;
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
  status?: Invoice.StatusEnum,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const existingInvoice = await getInvoice(invoiceId);

    if (!existingInvoice) {
      throw new Error(`Could not find invoice ${invoiceId}`);
    }

    const rejectionReason = formatRejectionReason(existingInvoice);

    if (rejectionReason) {
      return {
        result: null,
        isError: true,
        error: rejectionReason,
      };
    }

    const updatedInvoice = await updateInvoice(
      invoiceId,
      lineItems,
      reference,
      dueDate,
      date,
      contactId,
      status,
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
