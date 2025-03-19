import { xeroClient } from "../clients/xero-client.js";
import { Contacts, Invoice, Invoices } from "xero-node";
import { AxiosError } from "axios";
import { ToolResponse } from "../types/tool-response.js";

/**
 * Format error messages in a user-friendly way
 */
function formatError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const detail = error.response?.data?.Detail;

    switch (status) {
      case 401:
        return "Authentication failed. Please check your Xero credentials.";
      case 403:
        return "You don't have permission to access this resource in Xero.";
      case 404:
        return "The requested resource was not found in Xero.";
      case 429:
        return "Too many requests to Xero. Please try again in a moment.";
      default:
        return detail || "An error occurred while communicating with Xero.";
    }
  }
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

/**
 * List all contacts from Xero
 */
export async function listXeroContacts(): Promise<ToolResponse<Contacts>> {
  try {
    const tokenResponse = await xeroClient.getClientCredentialsToken();

    await xeroClient.setTokenSet({
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });

    const contacts = await xeroClient.accountingApi.getContacts("");

    return {
      result: contacts.body,
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

/**
 * List all invoices from Xero
 */
export async function listXeroInvoices(): Promise<ToolResponse<Invoices>> {
  try {
    const tokenResponse = await xeroClient.getClientCredentialsToken();

    await xeroClient.setTokenSet({
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });

    const { body: invoices } = await xeroClient.accountingApi.getInvoices("");

    return {
      result: invoices,
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
