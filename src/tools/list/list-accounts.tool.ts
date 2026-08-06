import { listXeroAccounts } from "../../handlers/list-xero-accounts.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListAccountsTool = CreateXeroTool(
  "list-accounts",
  "Lists all accounts in Xero. Use this tool to get account codes and names for invoices, bills, and payments.",
  {},
  async () => {
    const response = await listXeroAccounts();
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing accounts: ${response.error}`,
          },
        ],
      };
    }

    const accounts = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${accounts?.length || 0} accounts:`,
        },
        ...(accounts?.map((account) => ({
          type: "text" as const,
          text: [
            `Account: ${account.name || "Unnamed"}`,
            `Code: ${account.code || "No code"}`,
            `ID: ${account.accountID || "No ID"}`,
            `Type: ${account.type || "Unknown type"}`,
            `Status: ${account.status || "Unknown status"}`,
            account.description ? `Description: ${account.description}` : null,
            account.taxType ? `Tax Type: ${account.taxType}` : null,
            account.enablePaymentsToAccount !== undefined
              ? `Payments Enabled: ${account.enablePaymentsToAccount ? "Yes" : "No"}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListAccountsTool;
