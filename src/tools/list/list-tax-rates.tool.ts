import { ToolDefinition } from "../../types/tool-definition.js";
import { listXeroTaxRates } from "../../handlers/list-xero-tax-rates.handler.js";

const toolName = "list-tax-rates";
const toolDescription =
  "Lists all tax rates in Xero. Use this tool to get the tax rates to be used when creating invoices in Xero";
const toolSchema = {};

const toolHandler = async (): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> => {
  const response = await listXeroTaxRates();
  if (response.error !== null) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error listing tax rates: ${response.error}`,
        },
      ],
    };
  }

  const taxRates = response.result;

  return {
    content: [
      {
        type: "text" as const,
        text: `Found ${taxRates?.length || 0} tax rates:`,
      },
      ...(taxRates?.map((taxRate) => ({
        type: "text" as const,
        text: [
          `Tax Rate: ${taxRate.name || "Unnamed"}`,
          `Tax Type: ${taxRate.taxType || "No tax type"}`,
          `Status: ${taxRate.status || "Unknown status"}`,
          `Display Tax Rate: ${taxRate.displayTaxRate || "0.0000"}%`,
          `Effective Rate: ${taxRate.effectiveRate || "0.0000"}%`,
          taxRate.taxComponents?.length
            ? `Tax Components:\n${taxRate.taxComponents
                .map(
                  (comp) =>
                    `  - ${comp.name}: ${comp.rate}%${comp.isCompound ? " (Compound)" : ""}${comp.isNonRecoverable ? " (Non-recoverable)" : ""}`,
                )
                .join("\n")}`
            : null,
          `Can Apply To:${[
            taxRate.canApplyToAssets ? " Assets" : "",
            taxRate.canApplyToEquity ? " Equity" : "",
            taxRate.canApplyToExpenses ? " Expenses" : "",
            taxRate.canApplyToLiabilities ? " Liabilities" : "",
            taxRate.canApplyToRevenue ? " Revenue" : "",
          ].join("")}`,
        ]
          .filter(Boolean)
          .join("\n"),
      })) || []),
    ],
  };
};

export const ListTaxRatesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
