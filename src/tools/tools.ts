import { xeroClient } from "../clients/xero-client.js";
import { Invoice, Invoices } from "xero-node";
import { AxiosError } from "axios";
import { ToolResponse } from "../types/tool-response.js";

/**
 * Response format for the list contacts operation
 */
interface XeroContactResponse {
  success: boolean;
  error?: string;
  contacts?: Array<{
    contactId?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    emailAddress?: string;
    bankAccountDetails?: string;
    taxNumber?: string;
    accountsReceivableTaxType?: string;
    accountsPayableTaxType?: string;
    addresses?: Array<{
      addressType?: string;
      addressLine1?: string;
      addressLine2?: string;
      addressLine3?: string;
      addressLine4?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      attentionTo?: string;
    }>;
    phones?: Array<{
      phoneType?: string;
      phoneNumber?: string;
      phoneAreaCode?: string;
      phoneCountryCode?: string;
    }>;
    isSupplier?: boolean;
    isCustomer?: boolean;
    defaultCurrency?: string;
    updatedDateUTC?: string;
    contactStatus?: string;
    contactGroups?: Array<{
      id?: string;
      name?: string;
    }>;
    hasAttachments?: boolean;
    hasValidationErrors?: boolean;
  }>;
}

/**
 * Response format for creating an invoice
 */
interface CreateXeroInvoiceResponse {
  success: boolean;
  error?: string;
  invoice?: {
    invoiceId?: string;
    contact?: {
      name?: string;
    };
    total?: number;
    status?: string;
  };
}

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
export async function listXeroContacts(): Promise<XeroContactResponse> {
  try {
    const tokenResponse = await xeroClient.getClientCredentialsToken();

    await xeroClient.setTokenSet({
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });

    const contacts = await xeroClient.accountingApi.getContacts("");

    return {
      success: true,
      contacts: contacts.body.contacts?.map((contact) => ({
        contactId: contact.contactID,
        name: contact.name,
        firstName: contact.firstName,
        lastName: contact.lastName,
        emailAddress: contact.emailAddress,
        bankAccountDetails: contact.bankAccountDetails,
        taxNumber: contact.taxNumber,
        accountsReceivableTaxType:
          contact.accountsReceivableTaxType?.toString(),
        accountsPayableTaxType: contact.accountsPayableTaxType?.toString(),
        addresses: contact.addresses?.map((address) => ({
          addressType: address.addressType?.toString(),
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          addressLine3: address.addressLine3,
          addressLine4: address.addressLine4,
          city: address.city,
          region: address.region,
          postalCode: address.postalCode,
          country: address.country,
          attentionTo: address.attentionTo,
        })),
        phones: contact.phones?.map((phone) => ({
          phoneType: phone.phoneType?.toString(),
          phoneNumber: phone.phoneNumber,
          phoneAreaCode: phone.phoneAreaCode,
          phoneCountryCode: phone.phoneCountryCode,
        })),
        isSupplier: contact.isSupplier,
        isCustomer: contact.isCustomer,
        defaultCurrency: contact.defaultCurrency?.toString(),
        updatedDateUTC: contact.updatedDateUTC?.toISOString(),
        contactStatus: contact.contactStatus?.toString(),
        contactGroups: contact.contactGroups?.map((group) => ({
          id: group.contactGroupID,
          name: group.name,
        })),
        hasAttachments: contact.hasAttachments,
        hasValidationErrors: contact.hasValidationErrors,
      })),
    };
  } catch (error) {
    return {
      success: false,
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
      error: null,
    };
  } catch (error) {
    return {
      result: null,
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
): Promise<CreateXeroInvoiceResponse> {
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

    return {
      success: true,
      invoice: {
        invoiceId: createdInvoice?.invoiceID,
        contact: {
          name: createdInvoice?.contact?.name,
        },
        total: createdInvoice?.total,
        status: createdInvoice?.status?.toString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
}
