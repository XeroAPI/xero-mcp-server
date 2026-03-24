import { Invoice } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

interface UpdateInvoiceFieldsParams {
  invoiceId: string;
  dueDate?: string;
  date?: string;
  reference?: string;
  contactId?: string;
  expectedPaymentDate?: string;
  plannedPaymentDate?: string;
}

async function updateInvoiceFields({
  invoiceId,
  dueDate,
  date,
  reference,
  contactId,
  expectedPaymentDate,
  plannedPaymentDate,
}: UpdateInvoiceFieldsParams): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const invoice: Invoice = {
    dueDate,
    date,
    reference,
    expectedPaymentDate,
    plannedPaymentDate,
    contact: contactId ? { contactID: contactId } : undefined,
  };

  const response = await xeroClient.accountingApi.updateInvoice(
    xeroClient.tenantId,
    invoiceId,
    {
      invoices: [invoice],
    },
    undefined,
    undefined,
    getClientHeaders(),
  );

  return response.body.invoices?.[0];
}

export async function updateXeroInvoiceFields(
  params: UpdateInvoiceFieldsParams,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const hasAtLeastOneField = [
      params.dueDate,
      params.date,
      params.reference,
      params.contactId,
      params.expectedPaymentDate,
      params.plannedPaymentDate,
    ].some((value) => value !== undefined);

    if (!hasAtLeastOneField) {
      return {
        result: null,
        isError: true,
        error:
          "At least one field must be provided. Supported selective fields are dueDate, date, reference, contactId, expectedPaymentDate, and plannedPaymentDate.",
      };
    }

    const updatedInvoice = await updateInvoiceFields(params);

    if (!updatedInvoice) {
      throw new Error("Invoice field update failed.");
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
