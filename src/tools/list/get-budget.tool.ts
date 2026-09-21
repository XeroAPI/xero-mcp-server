import { z } from "zod";
import { getXeroBudget } from "../../handlers/list-xero-budgets.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

export default CreateXeroTool(
  "get-budget",
  "Retrieve a Xero budget, including account codes, period balances and tracking information. Use a budget ID from list-budgets. Requires accounting.budgets.read. This tool only reads data.",
  {
    budgetId: z.string().uuid().describe("Budget ID returned by list-budgets"),
    dateFrom: z
      .string()
      .date()
      .optional()
      .describe("Start date in YYYY-MM-DD format"),
    dateTo: z
      .string()
      .date()
      .optional()
      .describe("End date in YYYY-MM-DD format"),
  },
  async ({ budgetId, dateFrom, dateTo }) => {
    const response = await getXeroBudget(budgetId, dateFrom, dateTo);
    return {
      isError: response.isError,
      content: [
        {
          type: "text" as const,
          text:
            response.error !== null
              ? `Error getting budget: ${response.error}`
              : JSON.stringify(response.result, null, 2),
        },
      ],
    };
  },
);
