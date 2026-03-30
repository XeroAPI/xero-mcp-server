import { Invoice, RequestEmpty } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface InvoiceWorkflowResult {
  invoice: Invoice;
  approved: boolean;
  emailed: boolean;
}

const APPROVABLE_STATUSES = new Set<Invoice.StatusEnum>([
  Invoice.StatusEnum.DRAFT,
  Invoice.StatusEnum.SUBMITTED,
]);

const APPROVED_STATUSES = new Set<Invoice.StatusEnum>([
  Invoice.StatusEnum.AUTHORISED,
  Invoice.StatusEnum.PAID,
]);

async function getInvoice(invoiceId: string): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getInvoice(
    xeroClient.tenantId,
    invoiceId,
    undefined,
    getClientHeaders(),
  );

  return response.body.invoices?.[0];
}

async function approveInvoice(invoiceId: string): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.updateInvoice(
    xeroClient.tenantId,
    invoiceId,
    {
      invoices: [
        {
          status: Invoice.StatusEnum.AUTHORISED,
        },
      ],
    },
    undefined,
    undefined,
    getClientHeaders(),
  );

  return response.body.invoices?.[0];
}

async function emailInvoice(invoiceId: string): Promise<void> {
  await xeroClient.authenticate();

  await xeroClient.accountingApi.emailInvoice(
    xeroClient.tenantId,
    invoiceId,
    new RequestEmpty(),
    undefined,
    getClientHeaders(),
  );
}

function getStatus(invoice: Invoice): Invoice.StatusEnum | undefined {
  return invoice.status as Invoice.StatusEnum | undefined;
}

function ensureInvoiceExists(
  invoice: Invoice | undefined,
  invoiceId: string,
): asserts invoice is Invoice {
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }
}

function ensureInvoiceCanBeApproved(invoice: Invoice): void {
  const status = getStatus(invoice);

  if (APPROVED_STATUSES.has(status as Invoice.StatusEnum)) {
    return;
  }

  if (!APPROVABLE_STATUSES.has(status as Invoice.StatusEnum)) {
    throw new Error(
      `Cannot approve invoice because its current status is ${status || "unknown"}. Only DRAFT or SUBMITTED invoices can be approved.`,
    );
  }
}

function ensureInvoiceCanBeEmailed(invoice: Invoice): void {
  const status = getStatus(invoice);

  if (!APPROVED_STATUSES.has(status as Invoice.StatusEnum)) {
    throw new Error(
      `Cannot email invoice because it is not approved. Current status: ${status || "unknown"}.`,
    );
  }

  if (!invoice.contact?.emailAddress) {
    throw new Error(
      "Cannot email invoice because the related contact does not have an email address in Xero.",
    );
  }
}

export async function approveXeroInvoice(
  invoiceId: string,
): Promise<XeroClientResponse<InvoiceWorkflowResult>> {
  try {
    const existingInvoice = await getInvoice(invoiceId);
    ensureInvoiceExists(existingInvoice, invoiceId);
    ensureInvoiceCanBeApproved(existingInvoice);

    if (APPROVED_STATUSES.has(getStatus(existingInvoice) as Invoice.StatusEnum)) {
      return {
        result: {
          invoice: existingInvoice,
          approved: false,
          emailed: false,
        },
        isError: false,
        error: null,
      };
    }

    const approvedInvoice = await approveInvoice(invoiceId);
    ensureInvoiceExists(approvedInvoice, invoiceId);

    return {
      result: {
        invoice: approvedInvoice,
        approved: true,
        emailed: false,
      },
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

export async function emailXeroInvoice(
  invoiceId: string,
): Promise<XeroClientResponse<InvoiceWorkflowResult>> {
  try {
    const existingInvoice = await getInvoice(invoiceId);
    ensureInvoiceExists(existingInvoice, invoiceId);
    ensureInvoiceCanBeEmailed(existingInvoice);

    await emailInvoice(invoiceId);

    const refreshedInvoice = await getInvoice(invoiceId);
    ensureInvoiceExists(refreshedInvoice, invoiceId);

    return {
      result: {
        invoice: refreshedInvoice,
        approved: false,
        emailed: true,
      },
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

export async function approveAndEmailXeroInvoice(
  invoiceId: string,
): Promise<XeroClientResponse<InvoiceWorkflowResult>> {
  try {
    const existingInvoice = await getInvoice(invoiceId);
    ensureInvoiceExists(existingInvoice, invoiceId);
    ensureInvoiceCanBeApproved(existingInvoice);

    let workingInvoice = existingInvoice;
    let approved = false;

    if (!APPROVED_STATUSES.has(getStatus(existingInvoice) as Invoice.StatusEnum)) {
      const approvedInvoice = await approveInvoice(invoiceId);
      ensureInvoiceExists(approvedInvoice, invoiceId);
      workingInvoice = approvedInvoice;
      approved = true;
    }

    ensureInvoiceCanBeEmailed(workingInvoice);
    await emailInvoice(invoiceId);

    const refreshedInvoice = await getInvoice(invoiceId);
    ensureInvoiceExists(refreshedInvoice, invoiceId);

    return {
      result: {
        invoice: refreshedInvoice,
        approved,
        emailed: true,
      },
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
