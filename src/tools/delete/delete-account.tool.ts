import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { deleteXeroAccount } from "../../handlers/delete-xero-account.handler.js";

const DeleteAccountTool = CreateXeroTool(
  "delete-account",
  `Delete an account from the Xero chart of accounts.
  Xero only permits deleting accounts that have never had transactions posted to them and are not system accounts.
  For accounts with history, use update-account with status ARCHIVED instead.`,
  {
    accountId: z.string().describe("The accountID of the account to delete. Use list-accounts to find it."),
  },
  async ({ accountId }) => {
    const response = await deleteXeroAccount(accountId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting account: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Deleted account with ID: ${accountId}`,
        },
      ],
    };
  },
);

export default DeleteAccountTool;
