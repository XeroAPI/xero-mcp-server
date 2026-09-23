import { listXeroPayrollAuPayItems } from "../../handlers/list-xero-payroll-au-pay-items.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListPayrollPayItemsTool = CreateXeroTool(
  "list-payroll-pay-items",
  `List Australian Payroll AU pay items: earnings rates, deduction types, leave types and reimbursement types. Use this to map ordinary earnings versus allowances and to see which rates are exempt from super. Australian organisations only. Requires payroll.settings scope.`,
  {},
  async () => {
    const response = await listXeroPayrollAuPayItems();

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing pay items: ${response.error}`,
          },
        ],
      };
    }

    const payItems = response.result;

    if (!payItems) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No pay items found.",
          },
        ],
      };
    }

    const earnings =
      payItems.earningsRates
        ?.map((rate) =>
          [
            `  ${rate.name ?? rate.earningsRateID}`,
            rate.earningsType ? `type=${String(rate.earningsType)}` : null,
            rate.isExemptFromSuper !== undefined
              ? `exemptFromSuper=${rate.isExemptFromSuper}`
              : null,
            rate.isExemptFromTax !== undefined
              ? `exemptFromTax=${rate.isExemptFromTax}`
              : null,
            rate.isReportableAsW1 !== undefined
              ? `reportableAsW1=${rate.isReportableAsW1}`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join("\n") || "  None";

    const deductions =
      payItems.deductionTypes
        ?.map((item) => `  ${item.name ?? item.deductionTypeID}`)
        .join("\n") || "  None";

    const leave =
      payItems.leaveTypes
        ?.map((item) => `  ${item.name ?? item.leaveTypeID}`)
        .join("\n") || "  None";

    const reimbursements =
      payItems.reimbursementTypes
        ?.map((item) => `  ${item.name ?? item.reimbursementTypeID}`)
        .join("\n") || "  None";

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Earnings rates:",
            earnings,
            "Deduction types:",
            deductions,
            "Leave types:",
            leave,
            "Reimbursement types:",
            reimbursements,
          ].join("\n"),
        },
      ],
    };
  },
);

export default ListPayrollPayItemsTool;
