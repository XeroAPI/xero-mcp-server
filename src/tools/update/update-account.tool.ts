import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { updateXeroAccount } from "../../handlers/update-xero-account.handler.js";

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

const UpdateAccountTool = CreateXeroTool(
  "update-account",
  `Update an existing account in the Xero chart of accounts.
  Only the fields supplied are changed; everything else is preserved from the current account.
  Set status to ARCHIVED to archive an account (the safe alternative to deleting an account that has transactions),
  or ACTIVE to restore an archived account. System accounts cannot have their type changed.`,
  {
    accountId: z.string().describe("The accountID of the account to update. Use list-accounts to find it."),
    name: z.string().optional().describe("New account name (max 150 characters)."),
    code: z.string().optional().describe("New account code (max 10 characters). Must be unique."),
    type: accountTypeSchema.optional().describe("New account type."),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional().describe("Set to ARCHIVED to archive, ACTIVE to restore."),
    description: z.string().optional().describe("New description (max 4000 characters)."),
    taxType: z.string().optional().describe("New default tax type, e.g. OUTPUT, INPUT, NONE."),
    enablePaymentsToAccount: z.boolean().optional(),
    showInExpenseClaims: z.boolean().optional(),
    bankAccountNumber: z.string().optional().describe("Only applies to BANK accounts."),
    bankAccountType: z.enum(["BANK", "CREDITCARD", "PAYPAL"]).optional().describe("Only applies to BANK accounts."),
    currencyCode: z.string().optional().describe("ISO 4217 currency code. Only applies to BANK accounts."),
    addToWatchlist: z.boolean().optional(),
  },
  async ({ accountId, ...input }) => {
    const response = await updateXeroAccount(accountId, input);

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

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Updated account "${account.name}" (ID: ${account.accountID}).`,
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

export default UpdateAccountTool;
