import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createTimesheet: vi.fn(),
  createTimesheetLine: vi.fn(),
  updateTimesheetLine: vi.fn(),
  approveTimesheet: vi.fn(),
  revertTimesheet: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    payrollNZApi: {
      createTimesheet: mocks.createTimesheet,
      createTimesheetLine: mocks.createTimesheetLine,
      updateTimesheetLine: mocks.updateTimesheetLine,
      approveTimesheet: mocks.approveTimesheet,
      revertTimesheet: mocks.revertTimesheet,
    },
  },
}));

import { approveXeroPayrollTimesheet } from "../approve-xero-payroll-timesheet.handler.js";
import { createXeroPayrollTimesheet } from "../create-xero-payroll-timesheet.handler.js";
import { revertXeroPayrollTimesheet } from "../revert-xero-payroll-timesheet.handler.js";
import { updateXeroPayrollTimesheetAddLine } from "../update-xero-payroll-timesheet-add-line.handler.js";
import { updateXeroPayrollTimesheetUpdateLine } from "../update-xero-payroll-timesheet-update-line.handler.js";

const timesheet = {
  payrollCalendarID: "calendar-id",
  employeeID: "employee-id",
  startDate: "2026-08-01",
  endDate: "2026-08-07",
};

const timesheetLine = {
  earningsRateID: "earnings-rate-id",
  numberOfUnits: 8,
  date: "2026-08-01",
};

describe("payroll timesheet idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTimesheet.mockResolvedValue({ body: { timesheet } });
    mocks.createTimesheetLine.mockResolvedValue({ body: { timesheetLine } });
    mocks.updateTimesheetLine.mockResolvedValue({ body: { timesheetLine } });
    mocks.approveTimesheet.mockResolvedValue({ body: { timesheet } });
    mocks.revertTimesheet.mockResolvedValue({ body: { timesheet } });
  });

  it("forwards idempotency keys to every supported mutation", async () => {
    await createXeroPayrollTimesheet(timesheet, "create-key");
    await updateXeroPayrollTimesheetAddLine("timesheet-id", timesheetLine, "add-line-key");
    await updateXeroPayrollTimesheetUpdateLine("timesheet-id", "line-id", timesheetLine, "update-line-key");
    await approveXeroPayrollTimesheet("timesheet-id", "approve-key");
    await revertXeroPayrollTimesheet("timesheet-id", "revert-key");

    expect(mocks.createTimesheet).toHaveBeenCalledWith("tenant-id", timesheet, "create-key");
    expect(mocks.createTimesheetLine).toHaveBeenCalledWith("tenant-id", "timesheet-id", timesheetLine, "add-line-key");
    expect(mocks.updateTimesheetLine).toHaveBeenCalledWith("tenant-id", "timesheet-id", "line-id", timesheetLine, "update-line-key");
    expect(mocks.approveTimesheet).toHaveBeenCalledWith("tenant-id", "timesheet-id", "approve-key");
    expect(mocks.revertTimesheet).toHaveBeenCalledWith("tenant-id", "timesheet-id", "revert-key");
  });
});
