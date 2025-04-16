import { z } from "zod";
import { listXeroContactGroups } from "../../handlers/list-xero-contact-groups.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListContactGroupsTool = CreateXeroTool(
  "list-contact-groups",
  `List all contact groups in Xero.
  You can optionally specify a contact group ID to retrieve details for that specific group, including its contacts.`,
  {
    contactGroupId: z
      .string()
      .optional()
      .describe("Optional ID of the contact group to retrieve"),    
  },
  async (args) => {
    const response = await listXeroContactGroups(args?.contactGroupId);
    
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing contact groups: ${response.error}`,
          },
        ],
      };
    }

    const contactGroups = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${contactGroups?.length || 0} contact groups:`,
        },
        ...(contactGroups?.map((contactGroup) => ({
          type: "text" as const,
          text: [
            `Contact Group ID: ${contactGroup.contactGroupID}`,
            `Name: ${contactGroup.name}`,
            `Status: ${contactGroup.status}`,
            contactGroup.contacts
              ? contactGroup.contacts.map(contact => [
                  `Contact ID: ${contact.contactID}`,
                  `Name: ${contact.name}`,
                ].join('\n')
              ).join('\n')
              : "No contacts in this contact group.",            
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListContactGroupsTool;
