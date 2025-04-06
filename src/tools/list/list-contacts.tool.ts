import { listXeroContacts } from "../../handlers/list-xero-contacts.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListContactsTool = CreateXeroTool(
  "list-contacts",
  "List all contacts in Xero. This includes Suppliers and Customers.",
  {},
  async () => {
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

    const contacts = response.result;

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
            contact.accountsReceivableTaxType
              ? `AR Tax Type: ${contact.accountsReceivableTaxType}`
              : null,
            contact.accountsPayableTaxType
              ? `AP Tax Type: ${contact.accountsPayableTaxType}`
              : null,
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

export default ListContactsTool;
