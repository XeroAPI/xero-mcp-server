import { z } from "zod";
import { TaxRate } from "xero-node";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { updateXeroTaxRate } from "../../handlers/update-xero-tax-rate.handler.js";

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

const UpdateTaxRateTool = CreateXeroTool(
  "update-tax-rate",
  "Update an existing tax rate in Xero. Identify the tax rate by taxType (preferred, e.g. TAX001) or by name. \
Pass any subset of newName, status, taxComponents, or reportTaxType — fields not provided are kept. \
Set status to DELETED to delete the tax rate, or ARCHIVED to hide it from selection while preserving history. \
Updating taxComponents replaces the entire component list.",
  {
    taxType: z
      .string()
      .optional()
      .describe("Xero-assigned tax type (e.g. TAX001). Preferred identifier."),
    name: z
      .string()
      .optional()
      .describe(
        "Existing name (case-insensitive). Used as a fallback identifier when taxType is not provided.",
      ),
    newName: z
      .string()
      .optional()
      .describe("New display name. Omit to keep the existing name."),
    status: z.enum(["ACTIVE", "DELETED", "ARCHIVED"]).optional(),
    taxComponents: z.array(taxComponentSchema).min(1).optional(),
    reportTaxType: z.enum(reportTaxTypeValues).optional(),
  },
  async ({ taxType, name, newName, status, taxComponents, reportTaxType }) => {
    const response = await updateXeroTaxRate(
      { name, taxType },
      newName,
      status,
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
            text: `Error updating tax rate: ${response.error}`,
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
            `Updated tax rate "${taxRate.name}" (taxType: ${taxRate.taxType ?? "unknown"}).`,
            `Status: ${taxRate.status ?? "unknown"}`,
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

export default UpdateTaxRateTool;
