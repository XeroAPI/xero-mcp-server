import { updateXeroAccount } from "../../handlers/update-xero-account.handler.js";
import { z } from "zod";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { AccountType } from "xero-node";

const UpdateAccountTool = CreateXeroTool(
  "update-account",
  "Update an account in Xero's chart of accounts.\
  When an account is updated, a deep link to the account in Xero is returned. \
  This deep link can be used to view the account in Xero directly. \
  This link should be displayed to the user.",
  {
    accountId: z.string().describe("The Xero ID of the account to update"),
    name: z
      .string()
      .optional()
      .describe("Name of the account (max 150 chars)"),
    code: z
      .string()
      .optional()
      .describe("A unique alphanumeric account code (max 10 chars)"),
    type: z
      .enum([
        "BANK",
        "CURRENT",
        "CURRLIAB",
        "DEPRECIATN",
        "DIRECTCOSTS",
        "EQUITY",
        "EXPENSE",
        "FIXED",
        "INVENTORY",
        "LIABILITY",
        "NONCURRENT",
        "OTHERINCOME",
        "OVERHEADS",
        "PREPAYMENT",
        "REVENUE",
        "SALES",
        "TERMLIAB",
        "PAYG",
      ])
      .optional()
      .describe("The account type"),
    description: z
      .string()
      .optional()
      .describe(
        "Description of the account (max 4000 chars, not valid for bank accounts)",
      ),
    taxType: z
      .string()
      .optional()
      .describe("The tax type for the account"),
    currencyCode: z
      .string()
      .optional()
      .describe("The currency code (e.g., USD, GBP, NZD)"),
    enablePaymentsToAccount: z
      .boolean()
      .optional()
      .describe("Whether the account accepts payment applications"),
    showInExpenseClaims: z
      .boolean()
      .optional()
      .describe("Whether the account is available for expense claims"),
    reportingCode: z
      .string()
      .optional()
      .describe("Custom reporting code"),
    reportingCodeName: z
      .string()
      .optional()
      .describe("Name of the reporting code"),
    addToWatchlist: z
      .boolean()
      .optional()
      .describe("Whether the account is shown on the dashboard watchlist"),
  },
  async ({
    accountId,
    name,
    code,
    type,
    description,
    taxType,
    currencyCode,
    enablePaymentsToAccount,
    showInExpenseClaims,
    reportingCode,
    reportingCodeName,
    addToWatchlist,
  }) => {
    try {
      const response = await updateXeroAccount(
        accountId,
        name,
        code,
        type as unknown as AccountType,
        description,
        taxType,
        currencyCode,
        enablePaymentsToAccount,
        showInExpenseClaims,
        reportingCode,
        reportingCodeName,
        addToWatchlist,
      );

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating account: ${response.error}`,
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
              "Account updated successfully:",
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
            text: `Error updating account: ${err.message}`,
          },
        ],
      };
    }
  },
);

export default UpdateAccountTool;
