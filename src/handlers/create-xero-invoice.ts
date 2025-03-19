import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice } from "xero-node";

/**
 * Create a new invoice in Xero
 */
export async function createXeroInvoice(
  contactId: string,
  description: string,
  quantity: number,
  unitAmount: number,
  accountCode: string,
  taxType: string,
  reference?: string,
): Promise<ToolResponse<Invoice>> {
  try {
    const tokenResponse = await xeroClient.getClientCredentialsToken();

    await xeroClient.setTokenSet({
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });

    const invoice: Invoice = {
      type: Invoice.TypeEnum.ACCREC,
      contact: {
        contactID: contactId,
      },
      lineItems: [
        {
          description: description,
          quantity: quantity,
          unitAmount: unitAmount,
          accountCode: accountCode,
          taxType: taxType,
        },
      ],
      date: new Date().toISOString().split("T")[0], // Today's date
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 30 days from now
      reference: reference,
      status: Invoice.StatusEnum.DRAFT,
    };

    const response = await xeroClient.accountingApi.createInvoices("", {
      invoices: [invoice],
    });

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
