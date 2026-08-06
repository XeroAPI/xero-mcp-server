import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  createTimesheet: vi.fn(),
  getTimesheet: vi.fn(),
  addTimesheetLine: vi.fn(),
  updateTimesheetLine: vi.fn(),
  listPayrollEmployees: vi.fn(),
}));

vi.mock("../../handlers/create-xero-payroll-timesheet.handler.js", () => ({
  createXeroPayrollTimesheet: mocks.createTimesheet,
}));

vi.mock("../../handlers/get-xero-payroll-timesheet.handler.js", () => ({
  getXeroPayrollTimesheet: mocks.getTimesheet,
}));

vi.mock("../../handlers/update-xero-payroll-timesheet-add-line.handler.js", () => ({
  updateXeroPayrollTimesheetAddLine: mocks.addTimesheetLine,
}));

vi.mock("../../handlers/update-xero-payroll-timesheet-update-line.handler.js", () => ({
  updateXeroPayrollTimesheetUpdateLine: mocks.updateTimesheetLine,
}));

vi.mock("../../handlers/list-xero-payroll-employees.handler.js", () => ({
  listXeroPayrollEmployees: mocks.listPayrollEmployees,
}));

import CreatePayrollTimesheetTool from "../create/create-payroll-timesheet.tool.js";
import GetPayrollTimesheetTool from "../get/get-payroll-timesheet.tool.js";
import ListPayrollEmployeesTool from "../list/list-payroll-employees.tool.js";
import AddTimesheetLineTool from "../update/update-payroll-timesheet-add-line.tool.js";
import UpdatePayrollTimesheetLineTool from "../update/update-payroll-timesheet-update-line.tool.js";

const inputTimesheetLine = {
  date: "2026-08-01",
  earningsRateID: "rate-id",
  trackingItemID: "tracking-id",
  numberOfUnits: 8,
};

const returnedTimesheetLine = {
  ...inputTimesheetLine,
  timesheetLineID: "line-id",
};

describe("payroll timesheet details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a tracking item on every timesheet line write", () => {
    const createSchema = z.object(CreatePayrollTimesheetTool().schema as z.ZodRawShape);
    const addSchema = z.object(AddTimesheetLineTool().schema as z.ZodRawShape);
    const updateSchema = z.object(UpdatePayrollTimesheetLineTool().schema as z.ZodRawShape);

    expect(createSchema.safeParse({
      payrollCalendarID: "calendar-id",
      employeeID: "employee-id",
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      timesheetLines: [inputTimesheetLine],
    }).success).toBe(true);
    expect(addSchema.safeParse({ timesheetID: "timesheet-id", timesheetLine: inputTimesheetLine }).success).toBe(true);
    expect(updateSchema.safeParse({
      timesheetID: "timesheet-id",
      timesheetLineID: "line-id",
      timesheetLine: inputTimesheetLine,
    }).success).toBe(true);
  });

  it.each([0, -1])("rejects an invalid timesheet unit count of %s", (numberOfUnits) => {
    const createSchema = z.object(CreatePayrollTimesheetTool().schema as z.ZodRawShape);
    const addSchema = z.object(AddTimesheetLineTool().schema as z.ZodRawShape);
    const updateSchema = z.object(UpdatePayrollTimesheetLineTool().schema as z.ZodRawShape);
    const invalidLine = { ...inputTimesheetLine, numberOfUnits };

    expect(createSchema.safeParse({
      payrollCalendarID: "calendar-id",
      employeeID: "employee-id",
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      timesheetLines: [invalidLine],
    }).success).toBe(false);
    expect(addSchema.safeParse({ timesheetID: "timesheet-id", timesheetLine: invalidLine }).success).toBe(false);
    expect(updateSchema.safeParse({
      timesheetID: "timesheet-id",
      timesheetLineID: "line-id",
      timesheetLine: invalidLine,
    }).success).toBe(false);
  });

  it("returns line IDs and tracking allocations from a timesheet lookup", async () => {
    mocks.getTimesheet.mockResolvedValue({
      isError: false,
      result: {
        timesheetID: "timesheet-id",
        employeeID: "employee-id",
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        status: "DRAFT",
        totalHours: 8,
        timesheetLines: [returnedTimesheetLine],
      },
    });

    const result = await GetPayrollTimesheetTool().handler(
      { timesheetID: "timesheet-id" },
      {} as never,
    );

    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Timesheet Line ID: line-id"),
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Tracking Item ID: tracking-id"),
    });
  });

  it("preserves a tracking item when creating a timesheet and returns its line ID", async () => {
    mocks.createTimesheet.mockResolvedValue({
      isError: false,
      result: {
        timesheetID: "timesheet-id",
        payrollCalendarID: "calendar-id",
        employeeID: "employee-id",
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        timesheetLines: [returnedTimesheetLine],
      },
    });

    const result = await CreatePayrollTimesheetTool().handler({
      payrollCalendarID: "calendar-id",
      employeeID: "employee-id",
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      timesheetLines: [inputTimesheetLine],
    }, {} as never);

    expect(mocks.createTimesheet).toHaveBeenCalledWith(expect.objectContaining({
      timesheetLines: [expect.objectContaining({ trackingItemID: "tracking-id" })],
    }));
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Timesheet Line ID: line-id"),
    });
  });

  it("preserves tracking on added and updated lines, and returns their IDs", async () => {
    mocks.addTimesheetLine.mockResolvedValue({ isError: false, result: returnedTimesheetLine });
    mocks.updateTimesheetLine.mockResolvedValue({ isError: false, result: returnedTimesheetLine });

    const addResult = await AddTimesheetLineTool().handler({
      timesheetID: "timesheet-id",
      timesheetLine: inputTimesheetLine,
    }, {} as never);
    const updateResult = await UpdatePayrollTimesheetLineTool().handler({
      timesheetID: "timesheet-id",
      timesheetLineID: "line-id",
      timesheetLine: inputTimesheetLine,
    }, {} as never);

    expect(mocks.addTimesheetLine).toHaveBeenCalledWith("timesheet-id", inputTimesheetLine);
    expect(mocks.updateTimesheetLine).toHaveBeenCalledWith("timesheet-id", "line-id", inputTimesheetLine);
    expect(addResult.content[0]).toMatchObject({
      text: expect.stringContaining("Timesheet Line ID: line-id"),
    });
    expect(updateResult.content[0]).toMatchObject({
      text: expect.stringContaining("Tracking Item ID: tracking-id"),
    });
  });

  it("shows the employee payroll calendar required to create a timesheet", async () => {
    mocks.listPayrollEmployees.mockResolvedValue({
      isError: false,
      result: [{
        employeeID: "employee-id",
        payrollCalendarID: "calendar-id",
      }],
    });

    const result = await ListPayrollEmployeesTool().handler({}, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining("Payroll Calendar ID: calendar-id"),
    });
  });
});
