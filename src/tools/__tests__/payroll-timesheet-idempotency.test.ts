import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  createTimesheet: vi.fn(),
  addTimesheetLine: vi.fn(),
  updateTimesheetLine: vi.fn(),
  approveTimesheet: vi.fn(),
  revertTimesheet: vi.fn(),
}));

vi.mock("../../handlers/create-xero-payroll-timesheet.handler.js", () => ({
  createXeroPayrollTimesheet: mocks.createTimesheet,
}));

vi.mock("../../handlers/update-xero-payroll-timesheet-add-line.handler.js", () => ({
  updateXeroPayrollTimesheetAddLine: mocks.addTimesheetLine,
}));

vi.mock("../../handlers/update-xero-payroll-timesheet-update-line.handler.js", () => ({
  updateXeroPayrollTimesheetUpdateLine: mocks.updateTimesheetLine,
}));

vi.mock("../../handlers/approve-xero-payroll-timesheet.handler.js", () => ({
  approveXeroPayrollTimesheet: mocks.approveTimesheet,
}));

vi.mock("../../handlers/revert-xero-payroll-timesheet.handler.js", () => ({
  revertXeroPayrollTimesheet: mocks.revertTimesheet,
}));

import CreatePayrollTimesheetTool from "../create/create-payroll-timesheet.tool.js";
import ApprovePayrollTimesheetTool from "../update/approve-payroll-timesheet.tool.js";
import RevertPayrollTimesheetTool from "../update/revert-payroll-timesheet.tool.js";
import AddTimesheetLineTool from "../update/update-payroll-timesheet-add-line.tool.js";
import UpdatePayrollTimesheetLineTool from "../update/update-payroll-timesheet-update-line.tool.js";

const timesheetLine = {
  earningsRateID: "earnings-rate-id",
  numberOfUnits: 8,
  date: "2026-08-01",
};

describe("payroll timesheet idempotency tool inputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTimesheet.mockResolvedValue({ isError: false, result: { timesheetID: "timesheet-id" } });
    mocks.addTimesheetLine.mockResolvedValue({ isError: false, result: timesheetLine });
    mocks.updateTimesheetLine.mockResolvedValue({ isError: false, result: timesheetLine });
    mocks.approveTimesheet.mockResolvedValue({ isError: false, result: { timesheetID: "timesheet-id" } });
    mocks.revertTimesheet.mockResolvedValue({ isError: false, result: { timesheetID: "timesheet-id" } });
  });

  it("validates and forwards retry keys without adding them to a timesheet payload", async () => {
    const createTool = CreatePayrollTimesheetTool();
    const addLineTool = AddTimesheetLineTool();
    const updateLineTool = UpdatePayrollTimesheetLineTool();
    const approveTool = ApprovePayrollTimesheetTool();
    const revertTool = RevertPayrollTimesheetTool();

    await createTool.handler({
      payrollCalendarID: "calendar-id",
      employeeID: "employee-id",
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      idempotencyKey: "create-key",
    }, {} as never);
    await addLineTool.handler({ timesheetID: "timesheet-id", timesheetLine, idempotencyKey: "add-line-key" }, {} as never);
    await updateLineTool.handler({
      timesheetID: "timesheet-id",
      timesheetLineID: "line-id",
      timesheetLine,
      idempotencyKey: "update-line-key",
    }, {} as never);
    await approveTool.handler({ timesheetID: "timesheet-id", idempotencyKey: "approve-key" }, {} as never);
    await revertTool.handler({ timesheetID: "timesheet-id", idempotencyKey: "revert-key" }, {} as never);

    expect(mocks.createTimesheet).toHaveBeenCalledWith(
      expect.not.objectContaining({ idempotencyKey: expect.anything() }),
      "create-key",
    );
    expect(mocks.addTimesheetLine).toHaveBeenCalledWith("timesheet-id", timesheetLine, "add-line-key");
    expect(mocks.updateTimesheetLine).toHaveBeenCalledWith("timesheet-id", "line-id", timesheetLine, "update-line-key");
    expect(mocks.approveTimesheet).toHaveBeenCalledWith("timesheet-id", "approve-key");
    expect(mocks.revertTimesheet).toHaveBeenCalledWith("timesheet-id", "revert-key");

    for (const tool of [createTool, addLineTool, updateLineTool, approveTool, revertTool]) {
      const schema = z.object(tool.schema as z.ZodRawShape);
      expect(schema.shape.idempotencyKey.safeParse("").success).toBe(false);
      expect(schema.shape.idempotencyKey.safeParse("x".repeat(129)).success).toBe(false);
    }
  });
});
