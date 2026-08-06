import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listEmployeeLeaveTypes: vi.fn(),
  listLeavePeriods: vi.fn(),
}));

vi.mock("../handlers/list-xero-payroll-employee-leave-types.handler.js", () => ({
  listXeroPayrollEmployeeLeaveTypes: mocks.listEmployeeLeaveTypes,
}));

vi.mock("../handlers/list-xero-payroll-leave-periods.handler.js", () => ({
  listXeroPayrollLeavePeriods: mocks.listLeavePeriods,
}));

import ListPayrollEmployeeLeaveTypesTool from "./list/list-payroll-employee-leave-types.tool.js";
import ListPayrollLeavePeriodsTool from "./list/list-payroll-leave-periods.tool.js";

const textFrom = (result: Awaited<ReturnType<ReturnType<typeof ListPayrollEmployeeLeaveTypesTool>["handler"]>>) =>
  result.content.map((content) => content.type === "text" ? content.text : "").join("\n");

describe("payroll list formatting", () => {
  it("preserves zero leave-type values", async () => {
    mocks.listEmployeeLeaveTypes.mockResolvedValue({
      result: [{
        leaveTypeID: "leave-type-id",
        scheduleOfAccrual: "NoAccruals",
        unitsAccruedAnnually: 0,
        maximumToAccrue: 0,
        openingBalance: 0,
        rateAccruedHourly: 0,
      }],
      isError: false,
      error: null,
    });

    const result = await ListPayrollEmployeeLeaveTypesTool().handler(
      { employeeId: "employee-id" },
      {} as never,
    );
    const text = textFrom(result);

    expect(text).toContain("Units Accrued Annually: 0");
    expect(text).toContain("Maximum To Accrue: 0");
    expect(text).toContain("Opening Balance: 0");
    expect(text).toContain("Rate Accrued Hourly: 0");
  });

  it("renders zero leave-period values with accurate labels", async () => {
    mocks.listLeavePeriods.mockResolvedValue({
      result: [{
        periodStatus: "Approved",
        numberOfUnits: 0,
        numberOfUnitsTaken: 0,
        typeOfUnits: "Hours",
        typeOfUnitsTaken: "Days",
      }],
      isError: false,
      error: null,
    });

    const result = await ListPayrollLeavePeriodsTool().handler(
      { employeeId: "employee-id" },
      {} as never,
    );
    const text = textFrom(result as never);

    expect(text).toContain("Number of Units: 0");
    expect(text).toContain("Number of Units Taken: 0");
    expect(text).toContain("Type of Units: Hours");
    expect(text).toContain("Type of Units Taken: Days");
    expect(text).not.toContain("Payment Date:");
  });
});
