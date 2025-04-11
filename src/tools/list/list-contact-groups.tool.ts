import { listXeroContactGroups } from "../../handlers/list-xero-contact-groups.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListContactGroupsTool = CreateXeroTool(
  "list-contact-groups",
  `List all contact groups in Xero.`,
  {},
  async () => {
    const response = await listXeroContactGroups();
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
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListContactGroupsTool;
