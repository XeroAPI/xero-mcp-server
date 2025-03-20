import { listXeroContacts } from "../handlers/list-xero-contacts.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "list-contacts";
const toolDescription =
  "List all contacts in Xero. This includes Suppliers and Customers.";
const toolSchema = {};

const toolHandler = async (/*_args: {}, _extra: { signal: AbortSignal }*/) => {
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
          contact.emailAddress ? `Email: ${contact.emailAddress}` : "No email",
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
};

export const ListContactsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
