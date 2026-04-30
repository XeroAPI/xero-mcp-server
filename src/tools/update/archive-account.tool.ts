import { archiveXeroAccount } from "../../handlers/archive-xero-account.handler.js";
import { z } from "zod";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ArchiveAccountTool = CreateXeroTool(
  "archive-account",
  "Archive an account in Xero's chart of accounts. \
  This sets the account status to ARCHIVED. Only accounts with status ACTIVE can be archived. \
  When an account is archived, a deep link to the account in Xero is returned. \
  This deep link can be used to view the account in Xero directly. \
  This link should be displayed to the user.",
  {
    accountId: z.string().describe("The Xero ID of the account to archive"),
  },
  async ({ accountId }) => {
    try {
      const response = await archiveXeroAccount(accountId);

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error archiving account: ${response.error}`,
            },
          ],
        };
      }

      const account = response.result;

      const deepLink = account.accountID
        ? await getDeepLink(DeepLinkType.ACCOUNT, account.accountID)
        : null;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              "Account archived successfully:",
              `Name: ${account.name}`,
              `Code: ${account.code}`,
              `ID: ${account.accountID}`,
              `Type: ${account.type}`,
              `Status: ${account.status}`,
              deepLink ? `Link to view: ${deepLink}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    } catch (error) {
      const err = ensureError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: `Error archiving account: ${err.message}`,
          },
        ],
      };
    }
  },
);

export default ArchiveAccountTool;
