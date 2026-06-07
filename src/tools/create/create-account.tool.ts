import { createXeroAccount } from "../../handlers/create-xero-account.handler.js";
import { z } from "zod";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { AccountType } from "xero-node";

const CreateAccountTool = CreateXeroTool(
  "create-account",
  "Create an account in Xero's chart of accounts.\
  When an account is created, a deep link to the account in Xero is returned. \
  This deep link can be used to view the account in Xero directly. \
  This link should be displayed to the user.",
  {
    name: z.string().describe("Name of the account (max 150 chars)"),
    code: z.string().describe("A unique alphanumeric account code (max 10 chars)"),
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
    bankAccountNumber: z
      .string()
      .optional()
      .describe("Bank account number (only for BANK type accounts)"),
  },
  async ({ name, code, type, description, taxType, bankAccountNumber }) => {
    try {
      const response = await createXeroAccount(
        name,
        code,
        type as unknown as AccountType,
        description,
        taxType,
        bankAccountNumber,
      );

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating account: ${response.error}`,
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
              "Account created successfully:",
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
            text: `Error creating account: ${err.message}`,
          },
        ],
      };
    }
  },
);

export default CreateAccountTool;
