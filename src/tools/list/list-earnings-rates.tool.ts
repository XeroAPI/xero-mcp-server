import { z } from "zod";

import {
  listXeroEarningsRates,
  ListEarningsRatesParams,
  EarningsRateResult,
} from "../../handlers/list-xero-earnings-rates.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListEarningsRatesTool = CreateXeroTool(
  "list-earnings-rates",
  `List all earnings rates in Xero Payroll.
This shows the earnings rate IDs, names, types, and rates needed when creating timesheet lines.
For AU: retrieves earnings rates from Pay Items. For NZ/UK: retrieves from the dedicated earnings rates endpoint.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.`,
  {
    page: z.number().optional().describe("Page number for pagination."),
  },
  async (params: ListEarningsRatesParams) => {
    const response = await listXeroEarningsRates(params);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing earnings rates: ${response.error}`,
          },
        ],
      };
    }

    const rates = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${rates?.length || 0} earnings rates:`,
        },
        ...(rates?.map((rate: EarningsRateResult) => ({
          type: "text" as const,
          text: [
            `Name: ${rate.name}`,
            `Earnings Rate ID: ${rate.earningsRateID}`,
            `Earnings Type: ${rate.earningsType}`,
            `Rate Type: ${rate.rateType}`,
            rate.ratePerUnit !== undefined ? `Rate Per Unit: ${rate.ratePerUnit}` : null,
            rate.fixedAmount !== undefined ? `Fixed Amount: ${rate.fixedAmount}` : null,
            rate.currentRecord !== undefined ? `Active: ${rate.currentRecord ? "Yes" : "No"}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListEarningsRatesTool;
