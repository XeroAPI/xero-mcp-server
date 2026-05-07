import { LeavePeriod } from "xero-node/dist/gen/model/payroll-nz/leavePeriod.js";

const DAY_UNIT_NAMES = new Set(["day", "days"]);
const DAY_AMOUNT_LABELS = new Map<number, string>([
  [0.25, "1/4 day"],
  [0.5, "1/2 day"],
  [0.75, "3/4 day"],
  [1, "full day"],
]);

function getDayAmountLabel(numberOfUnits: number, typeOfUnits?: string): string | null {
  if (!typeOfUnits || !DAY_UNIT_NAMES.has(typeOfUnits.trim().toLowerCase())) {
    return null;
  }

  return DAY_AMOUNT_LABELS.get(numberOfUnits) ?? null;
}

function formatLeaveUnitAmount(
  label: string,
  numberOfUnits?: number,
  typeOfUnits?: string,
): string | null {
  if (numberOfUnits === undefined) {
    return null;
  }

  const formattedTypeOfUnits =
    numberOfUnits === 1 && typeOfUnits?.endsWith("s")
      ? typeOfUnits.slice(0, -1)
      : typeOfUnits;
  const amount = `${numberOfUnits}${
    formattedTypeOfUnits ? ` ${formattedTypeOfUnits}` : ""
  }`;
  const dayAmountLabel = getDayAmountLabel(numberOfUnits, typeOfUnits);

  return `${label}: ${dayAmountLabel ? `${amount} (${dayAmountLabel})` : amount}`;
}

function hasDifferentLeaveAmounts(period: LeavePeriod): boolean {
  return (
    period.numberOfUnitsTaken === undefined ||
    period.numberOfUnits !== period.numberOfUnitsTaken ||
    period.typeOfUnits !== period.typeOfUnitsTaken
  );
}

export function formatLeavePeriod(period: LeavePeriod, index?: number): string {
  return [
    index !== undefined ? `Period ${index + 1}` : "Period",
    period.periodStartDate ? `Start Date: ${period.periodStartDate}` : null,
    period.periodEndDate ? `End Date: ${period.periodEndDate}` : null,
    formatLeaveUnitAmount(
      "Leave Taken",
      period.numberOfUnitsTaken,
      period.typeOfUnitsTaken,
    ),
    hasDifferentLeaveAmounts(period)
      ? formatLeaveUnitAmount(
          "Leave Amount",
          period.numberOfUnits,
          period.typeOfUnits,
        )
      : null,
    period.periodStatus ? `Status: ${period.periodStatus}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatLeavePeriods(periods?: LeavePeriod[]): string | null {
  if (!periods?.length) {
    return null;
  }

  return [
    `Periods (${periods.length}):`,
    ...periods.map((period, index) => formatLeavePeriod(period, index)),
  ].join("\n");
}
