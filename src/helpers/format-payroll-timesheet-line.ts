import { TimesheetLine } from "xero-node/dist/gen/model/payroll-nz/timesheetLine.js";

export const formatPayrollTimesheetLine = (line: TimesheetLine): string => {
  return [
    line.timesheetLineID ? `Timesheet Line ID: ${line.timesheetLineID}` : null,
    `Date: ${line.date}`,
    `Earnings Rate ID: ${line.earningsRateID}`,
    line.trackingItemID ? `Tracking Item ID: ${line.trackingItemID}` : null,
    `Units: ${line.numberOfUnits}`,
  ]
    .filter(Boolean)
    .join("\n");
};
