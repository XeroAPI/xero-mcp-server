import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listTimesheets: vi.fn(),
}));

vi.mock("../../handlers/list-xero-timesheets.handler.js", () => ({
  listXeroPayrollTimesheets: mocks.listTimesheets,
}));

import ListPayrollTimesheetsTool from "../list/list-payroll-timesheets.tool.js";

describe("list-timesheets tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTimesheets.mockResolvedValue({ isError: false, result: [] });
  });

  it("passes through the requested page and identifies it in the output", async () => {
    const result = await ListPayrollTimesheetsTool().handler({ page: 2 }, {} as never);

    expect(mocks.listTimesheets).toHaveBeenCalledWith(2);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Found 0 timesheets (page 2):",
    });
  });

  it("keeps zero hours without rendering absent optional fields as undefined", async () => {
    mocks.listTimesheets.mockResolvedValue({
      isError: false,
      result: [{
        payrollCalendarID: "calendar-id",
        employeeID: "employee-id",
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        totalHours: 0,
      }],
    });

    const result = await ListPayrollTimesheetsTool().handler({}, {} as never);

    expect(result.content[1]).toEqual({
      type: "text",
      text: [
        "Employee ID: employee-id",
        "Start Date: 2026-08-01",
        "End Date: 2026-08-07",
        "Total Hours: 0",
        "Timesheet lines: Use get-timesheet for line details.",
      ].join("\n"),
    });
  });
});
