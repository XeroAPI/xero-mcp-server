import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroAccount } from "../../handlers/create-xero-account.handler.js";

const accountTypeSchema = z.enum([
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
]);

const CreateAccountTool = CreateXeroTool(
  "create-account",
  `Create a new account in the Xero chart of accounts.
  Requires a name and an account type. Code is optional for BANK accounts but recommended for all others.
  BANK accounts require a bankAccountNumber and should specify bankAccountType (BANK, CREDITCARD or PAYPAL).
  Use list-tax-rates to find valid taxType values and list-accounts to check existing codes before creating.`,
  {
    name: z.string().describe("Account name (max 150 characters)."),
    type: accountTypeSchema.describe("Xero account type, e.g. REVENUE, EXPENSE, CURRENT, BANK."),
    code: z
      .string()
      .optional()
      .describe("Account code (max 10 characters). Must be unique. Required for non-bank accounts."),
    description: z.string().optional().describe("Account description (max 4000 characters)."),
    taxType: z.string().optional().describe("Default tax type for the account, e.g. OUTPUT, INPUT, NONE."),
    enablePaymentsToAccount: z
      .boolean()
      .optional()
      .describe("Whether payments can be applied directly to this account."),
    showInExpenseClaims: z
      .boolean()
      .optional()
      .describe("Whether the account is available for use in expense claims."),
    bankAccountNumber: z.string().optional().describe("Required for BANK accounts."),
    bankAccountType: z
      .enum(["BANK", "CREDITCARD", "PAYPAL"])
      .optional()
      .describe("Bank account type. Only used for BANK accounts."),
    currencyCode: z.string().optional().describe("ISO 4217 currency code. Only used for BANK accounts."),
    addToWatchlist: z.boolean().optional().describe("Show the account on the dashboard watchlist."),
  },
  async (input) => {
    const response = await createXeroAccount(input);

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

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Created account "${account.name}" (ID: ${account.accountID}).`,
            `Code: ${account.code || "No code"}`,
            `Type: ${account.type || "Unknown type"}`,
            `Status: ${account.status || "Unknown status"}`,
            account.taxType ? `Tax Type: ${account.taxType}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateAccountTool;
