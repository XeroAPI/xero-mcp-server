import { z } from "zod";
import { TaxRate } from "xero-node";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroTaxRate } from "../../handlers/create-xero-tax-rate.handler.js";

const taxComponentSchema = z.object({
  name: z.string(),
  rate: z.number().describe("Percentage as a decimal up to 4dp (e.g. 8.875)"),
  isCompound: z.boolean().optional(),
  isNonRecoverable: z
    .boolean()
    .optional()
    .describe("Canadian organisations only."),
});

const reportTaxTypeValues = Object.keys(TaxRate.ReportTaxTypeEnum).filter((k) =>
  Number.isNaN(Number(k)),
) as [string, ...string[]];

const CreateTaxRateTool = CreateXeroTool(
  "create-tax-rate",
  "Create a tax rate in Xero. Provide a name and one or more tax components. \
The effective rate is the sum of component rates (or compounded if any component is marked compound). \
Xero auto-assigns a taxType (e.g. TAX001) on creation; use that taxType to update or delete the tax rate later.",
  {
    name: z.string(),
    taxComponents: z.array(taxComponentSchema).min(1),
    reportTaxType: z
      .enum(reportTaxTypeValues)
      .optional()
      .describe(
        "Region-specific reporting category (e.g. OUTPUT, INPUT, SALESOUTPUT, USSALESTAX). Leave unset for most US use cases.",
      ),
  },
  async ({ name, taxComponents, reportTaxType }) => {
    const response = await createXeroTaxRate(
      name,
      taxComponents,
      reportTaxType
        ? TaxRate.ReportTaxTypeEnum[
            reportTaxType as keyof typeof TaxRate.ReportTaxTypeEnum
          ]
        : undefined,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating tax rate: ${response.error}`,
          },
        ],
      };
    }

    const taxRate = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Created tax rate "${taxRate.name}" (taxType: ${taxRate.taxType ?? "unknown"}).`,
            `Effective rate: ${taxRate.effectiveRate ?? "0"}%`,
            taxRate.taxComponents?.length
              ? `Components:\n${taxRate.taxComponents
                  .map(
                    (c) =>
                      `  - ${c.name}: ${c.rate}%${c.isCompound ? " (Compound)" : ""}${c.isNonRecoverable ? " (Non-recoverable)" : ""}`,
                  )
                  .join("\n")}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateTaxRateTool;
