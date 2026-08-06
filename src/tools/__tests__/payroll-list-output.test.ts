import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLeavePeriods: vi.fn(),
  listEmployees: vi.fn(),
}));

vi.mock("../../handlers/list-xero-payroll-leave-periods.handler.js", () => ({
  listXeroPayrollLeavePeriods: mocks.listLeavePeriods,
}));

vi.mock("../../handlers/list-xero-payroll-employees.handler.js", () => ({
  listXeroPayrollEmployees: mocks.listEmployees,
}));

import ListPayrollEmployeesTool from "../list/list-payroll-employees.tool.js";
import ListPayrollLeavePeriodsTool from "../list/list-payroll-leave-periods.tool.js";

describe("payroll list tool output", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the correct leave-period labels and keeps zero unit counts", async () => {
    mocks.listLeavePeriods.mockResolvedValue({
      isError: false,
      result: [{
        periodStatus: "Completed",
        periodStartDate: "2026-08-01",
        periodEndDate: "2026-08-07",
        numberOfUnits: 0,
        numberOfUnitsTaken: 0,
        typeOfUnits: "Hours",
        typeOfUnitsTaken: "Days",
      }],
    });

    const result = await ListPayrollLeavePeriodsTool().handler({
      employeeId: "employee-id",
    }, {} as never);

    expect(result.content[1]).toEqual({
      type: "text",
      text: [
        "Period Status: Completed",
        "Start Date: 2026-08-01",
        "End Date: 2026-08-07",
        "Number of Units: 0",
        "Number of Units Taken: 0",
        "Type of Units: Hours",
        "Type of Units Taken: Days",
      ].join("\n"),
    });
  });

  it("renders the documented employee ID and date of birth fields", async () => {
    mocks.listEmployees.mockResolvedValue({
      isError: false,
      result: [{
        employeeID: "employee-id",
        dateOfBirth: "1990-01-02",
      }],
    });

    const result = await ListPayrollEmployeesTool().handler({}, {} as never);

    expect(ListPayrollEmployeesTool().description).toContain("employee IDs");
    expect(ListPayrollEmployeesTool().description).not.toContain("User IDs");
    expect(result.content[1]).toEqual({
      type: "text",
      text: [
        "Employee ID: employee-id",
        "Date of Birth: 1990-01-02",
        "No email",
        "No status",
      ].join("\n"),
    });
  });
});
