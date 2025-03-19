#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { xeroClient } from "./clients/xero-client.js";
import { Contact, Phone } from "xero-node";
import {
  listXeroContacts,
  listXeroInvoices,
  createXeroInvoice,
} from "./tools/tools.js";

// Create an MCP server
const server = new McpServer({
  name: "Xero MCP Server",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Add tool to list contacts
server.tool(
  "list-contacts",
  {},
  async (/*_args: {}, _extra: { signal: AbortSignal }*/) => {
    const response = await listXeroContacts();
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing contacts: ${response.error}`,
          },
        ],
      };
    }

    const contacts = response.result.contacts;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${contacts?.length || 0} contacts:`,
        },
        ...(contacts?.map((contact) => ({
          type: "text" as const,
          text: [
            `Contact: ${contact.name}`,
            `ID: ${contact.contactID}`,
            contact.firstName ? `First Name: ${contact.firstName}` : null,
            contact.lastName ? `Last Name: ${contact.lastName}` : null,
            contact.emailAddress
              ? `Email: ${contact.emailAddress}`
              : "No email",
            contact.bankAccountDetails
              ? `Bank Account: ${contact.bankAccountDetails}`
              : null,
            contact.taxNumber ? `Tax Number: ${contact.taxNumber}` : null,
            contact.accountsReceivableTaxType
              ? `AR Tax Type: ${contact.accountsReceivableTaxType}`
              : null,
            contact.accountsPayableTaxType
              ? `AP Tax Type: ${contact.accountsPayableTaxType}`
              : null,
            contact.addresses?.length ? "Addresses:" : null,
            ...(contact.addresses?.map(
              (addr) =>
                `  ${addr.addressType}: ${[
                  addr.addressLine1,
                  addr.addressLine2,
                  addr.addressLine3,
                  addr.addressLine4,
                  addr.city,
                  addr.region,
                  addr.postalCode,
                  addr.country,
                ]
                  .filter(Boolean)
                  .join(
                    ", ",
                  )}${addr.attentionTo ? ` (Attn: ${addr.attentionTo})` : ""}`,
            ) || []),
            contact.phones?.length ? "Phone Numbers:" : null,
            ...(contact.phones?.map(
              (phone) =>
                `  ${phone.phoneType}: ${[
                  phone.phoneCountryCode,
                  phone.phoneAreaCode,
                  phone.phoneNumber,
                ]
                  .filter(Boolean)
                  .join(" ")}`,
            ) || []),
            `Type: ${
              [
                contact.isCustomer ? "Customer" : null,
                contact.isSupplier ? "Supplier" : null,
              ]
                .filter(Boolean)
                .join(", ") || "Unknown"
            }`,
            contact.defaultCurrency
              ? `Default Currency: ${contact.defaultCurrency}`
              : null,
            contact.updatedDateUTC
              ? `Last Updated: ${contact.updatedDateUTC}`
              : null,
            `Status: ${contact.contactStatus || "Unknown"}`,
            contact.contactGroups?.length
              ? `Groups: ${contact.contactGroups.map((g) => g.name).join(", ")}`
              : null,
            contact.hasAttachments ? "Has Attachments: Yes" : null,
            contact.hasValidationErrors ? "Has Validation Errors: Yes" : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

// Add tool to list invoices
server.tool(
  "list-invoices",
  {},
  async (/*_args: {}, _extra: { signal: AbortSignal }*/) => {
    const response = await listXeroInvoices();
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing invoices: ${response.error}`,
          },
        ],
      };
    }

    const invoices = response.result.invoices;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${invoices?.length || 0} invoices:`,
        },
        ...(invoices?.map((invoice) => ({
          type: "text" as const,
          text: [
            `Invoice: ${invoice.invoiceNumber || invoice.invoiceID}`,
            invoice.reference ? `Reference: ${invoice.reference}` : null,
            `Type: ${invoice.type || "Unknown"}`,
            `Status: ${invoice.status || "Unknown"}`,
            invoice.contact
              ? `Contact: ${invoice.contact.name} (${invoice.contact.contactID})`
              : null,
            invoice.date ? `Date: ${invoice.date}` : null,
            invoice.dueDate ? `Due Date: ${invoice.dueDate}` : null,
            invoice.lineAmountTypes
              ? `Line Amount Types: ${invoice.lineAmountTypes}`
              : null,
            invoice.lineItems?.length ? "Line Items:" : null,
            ...(invoice.lineItems?.map(
              (item) =>
                `  - ${item.description || "No description"}
    Quantity: ${item.quantity || 0}
    Unit Amount: ${item.unitAmount || 0}
    Line Amount: ${item.lineAmount || 0}${
      item.taxType
        ? `
    Tax Type: ${item.taxType}`
        : ""
    }${
      item.taxAmount
        ? `
    Tax Amount: ${item.taxAmount}`
        : ""
    }${
      item.accountCode
        ? `
    Account Code: ${item.accountCode}`
        : ""
    }${
      item.discountRate
        ? `
    Discount Rate: ${item.discountRate}`
        : ""
    }${
      item.tracking?.length
        ? `
    Tracking: ${item.tracking.map((t) => `${t.name}: ${t.option}`).join(", ")}`
        : ""
    }`,
            ) || []),
            invoice.subTotal ? `Sub Total: ${invoice.subTotal}` : null,
            invoice.totalTax ? `Total Tax: ${invoice.totalTax}` : null,
            `Total: ${invoice.total || 0}`,
            invoice.totalDiscount
              ? `Total Discount: ${invoice.totalDiscount}`
              : null,
            invoice.currencyCode ? `Currency: ${invoice.currencyCode}` : null,
            invoice.currencyRate
              ? `Currency Rate: ${invoice.currencyRate}`
              : null,
            invoice.updatedDateUTC
              ? `Last Updated: ${invoice.updatedDateUTC}`
              : null,
            invoice.fullyPaidOnDate
              ? `Fully Paid On: ${invoice.fullyPaidOnDate}`
              : null,
            invoice.amountDue ? `Amount Due: ${invoice.amountDue}` : null,
            invoice.amountPaid ? `Amount Paid: ${invoice.amountPaid}` : null,
            invoice.amountCredited
              ? `Amount Credited: ${invoice.amountCredited}`
              : null,
            invoice.hasAttachments ? "Has Attachments: Yes" : null,
            invoice.hasErrors ? "Has Errors: Yes" : null,
            invoice.isDiscounted ? "Is Discounted: Yes" : null,
            invoice.payments?.length ? "Payments:" : null,
            ...(invoice.payments?.map(
              (payment) =>
                `  - ID: ${payment.paymentID}
    Date: ${payment.date || "Unknown"}
    Amount: ${payment.amount || 0}${
      payment.reference
        ? `
    Reference: ${payment.reference}`
        : ""
    }${
      payment.hasAccount
        ? `
    Has Account: Yes`
        : ""
    }${
      payment.hasValidationErrors
        ? `
    Has Validation Errors: Yes`
        : ""
    }`,
            ) || []),
            invoice.prepayments?.length ? "Prepayments:" : null,
            ...(invoice.prepayments?.map(
              (prepayment) =>
                `  - ID: ${prepayment.prepaymentID}
    Date: ${prepayment.date || "Unknown"}${
      prepayment.reference
        ? `
    Reference: ${prepayment.reference}`
        : ""
    }`,
            ) || []),
            invoice.overpayments?.length ? "Overpayments:" : null,
            ...(invoice.overpayments?.map(
              (overpayment) =>
                `  - ID: ${overpayment.overpaymentID}
    Date: ${overpayment.date || "Unknown"}`,
            ) || []),
            invoice.creditNotes?.length ? "Credit Notes:" : null,
            ...(invoice.creditNotes?.map(
              (note) =>
                `  - ID: ${note.creditNoteID}
    Number: ${note.creditNoteNumber || "Unknown"}${
      note.reference
        ? `
    Reference: ${note.reference}`
        : ""
    }
    Type: ${note.type || "Unknown"}
    Status: ${note.status || "Unknown"}
    Sub Total: ${note.subTotal || 0}
    Total Tax: ${note.totalTax || 0}
    Total: ${note.total || 0}
    Last Updated: ${note.updatedDateUTC || "Unknown"}`,
            ) || []),
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

// Add a tool to create a contact
server.tool(
  "create-contact",
  {
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  },
  async (
    { name, email, phone }: { name: string; email?: string; phone?: string },
    //_extra: { signal: AbortSignal },
  ) => {
    try {
      const tokenResponse = await xeroClient.getClientCredentialsToken();

      await xeroClient.setTokenSet({
        access_token: tokenResponse.access_token,
        expires_in: tokenResponse.expires_in,
        token_type: tokenResponse.token_type,
      });

      const contact: Contact = {
        name,
        emailAddress: email,
        phones: phone
          ? [
              {
                phoneNumber: phone,
                phoneType: Phone.PhoneTypeEnum.MOBILE,
              },
            ]
          : undefined,
      };

      const response = await xeroClient.accountingApi.createContacts("", {
        contacts: [contact],
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Contact created: ${response.body.contacts?.[0].name} (ID: ${response.body.contacts?.[0].contactID})`,
          },
        ],
      };
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating contact: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Add tool to create an invoice
server.tool(
  "create-invoice",
  {
    contactId: z.string(),
    description: z.string(),
    quantity: z.number(),
    unitAmount: z.number(),
    accountCode: z.string(),
    taxType: z.string(),
    reference: z.string().optional(),
  },
  async (
    {
      contactId,
      description,
      quantity,
      unitAmount,
      accountCode,
      taxType,
      reference,
    }: {
      contactId: string;
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType: string;
      reference?: string;
    },
    //_extra: { signal: AbortSignal },
  ) => {
    const result = await createXeroInvoice(
      contactId,
      description,
      quantity,
      unitAmount,
      accountCode,
      taxType,
      reference,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating invoice: ${result.error}`,
          },
        ],
      };
    }

    const invoice = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Invoice created successfully:
- ID: ${invoice?.invoiceID}
- Contact: ${invoice?.contact?.name}
- Total: ${invoice?.total}
- Status: ${invoice?.status}`,
        },
      ],
    };
  },
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
