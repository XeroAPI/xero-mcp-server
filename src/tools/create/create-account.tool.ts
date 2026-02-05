import { createXeroAccount } from "../../handlers/create-xero-account.handler.js";
import { z } from "zod";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { Account, AccountType, CurrencyCode } from "xero-node";

const accountTypeEnum = z.enum([
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

const bankAccountTypeEnum = z.enum([
  "BANK",
  "CREDITCARD",
  "PAYPAL",
]);

const CreateAccountTool = CreateXeroTool(
  "create-account",
  "Create an account in Xero's chart of accounts. \
  Use this to add new accounts for tracking revenue, expenses, assets, liabilities, or equity. \
  When an account is created, details including the account ID are returned.",
  {
    code: z.string().describe("A unique code for the account (e.g., '200', '400', '610')"),
    name: z.string().describe("The name of the account (e.g., 'Sales', 'Office Supplies', 'Bank Account')"),
    type: accountTypeEnum.describe(
      "The account type. Common types: REVENUE (income), EXPENSE (costs), BANK (bank accounts), " +
      "CURRENT (current assets), CURRLIAB (current liabilities), FIXED (fixed assets), " +
      "EQUITY (owner's equity), DIRECTCOSTS (cost of goods sold), OVERHEADS (operating expenses)"
    ),
    description: z.string().optional().describe("A description of the account's purpose"),
    taxType: z.string().optional().describe("The tax type for the account (e.g., 'OUTPUT', 'INPUT', 'NONE')"),
    enablePaymentsToAccount: z.boolean().optional().describe("Enable payments to this account (for BANK type accounts)"),
    showInExpenseClaims: z.boolean().optional().describe("Show this account in expense claims"),
    bankAccountNumber: z.string().optional().describe("Bank account number (required for BANK type accounts)"),
    bankAccountType: bankAccountTypeEnum.optional().describe("Type of bank account: BANK, CREDITCARD, or PAYPAL (required for BANK type accounts)"),
    currencyCode: z.string().optional().describe("Currency code for the account (e.g., 'USD', 'GBP', 'AUD')"),
  },
  async ({
    code,
    name,
    type,
    description,
    taxType,
    enablePaymentsToAccount,
    showInExpenseClaims,
    bankAccountNumber,
    bankAccountType,
    currencyCode,
  }) => {
    try {
      const accountType = AccountType[type as keyof typeof AccountType];
      const bankAcctType = bankAccountType
        ? Account.BankAccountTypeEnum[bankAccountType as keyof typeof Account.BankAccountTypeEnum]
        : undefined;
      const currency = currencyCode
        ? CurrencyCode[currencyCode as keyof typeof CurrencyCode]
        : undefined;

      const response = await createXeroAccount(
        code,
        name,
        accountType,
        description,
        taxType,
        enablePaymentsToAccount,
        showInExpenseClaims,
        bankAccountNumber,
        bankAcctType,
        currency,
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

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Account created successfully:`,
              `Name: ${account.name}`,
              `Code: ${account.code}`,
              `ID: ${account.accountID}`,
              `Type: ${account.type}`,
              `Status: ${account.status}`,
              account.description ? `Description: ${account.description}` : null,
              account.taxType ? `Tax Type: ${account.taxType}` : null,
              account.bankAccountNumber ? `Bank Account Number: ${account.bankAccountNumber}` : null,
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
