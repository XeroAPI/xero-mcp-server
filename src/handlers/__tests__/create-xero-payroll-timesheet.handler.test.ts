import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { createTimesheet: vi.fn() },
    payrollNZApi: { createTimesheet: vi.fn() },
    payrollUKApi: { createTimesheet: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { createXeroPayrollTimesheet } from "../create-xero-payroll-timesheet.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createXeroPayrollTimesheet", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUV2Api.createTimesheet with single object", async () => {
      mockXeroClient.payrollAUV2Api.createTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-new" } },
      });

      await createXeroPayrollTimesheet({
        employeeID: "emp-1",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        payrollCalendarID: "cal-1",
      });

      const call = mockXeroClient.payrollAUV2Api.createTimesheet.mock.calls[0];
      expect(call[0]).toBe("test-tenant-id");
      expect(call[1].payrollCalendarID).toBe("cal-1");
      expect(call[1].employeeID).toBe("emp-1");
    });

    it("passes timesheetLines with date and single numberOfUnits", async () => {
      mockXeroClient.payrollAUV2Api.createTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-new" } },
      });

      await createXeroPayrollTimesheet({
        employeeID: "emp-1",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        payrollCalendarID: "cal-1",
        timesheetLines: [
          { earningsRateID: "rate-1", numberOfUnits: 8, date: "2024-01-01" },
        ],
      });

      const timesheet = mockXeroClient.payrollAUV2Api.createTimesheet.mock.calls[0][1];
      expect(timesheet.timesheetLines[0].numberOfUnits).toBe(8);
      expect(timesheet.timesheetLines[0].date).toBe("2024-01-01");
    });
  });

  describe("NZ region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
    });

    it("calls payrollNZApi.createTimesheet with payrollCalendarID", async () => {
      mockXeroClient.payrollNZApi.createTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-new" } },
      });

      await createXeroPayrollTimesheet({
        employeeID: "emp-1",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        payrollCalendarID: "cal-1",
      });

      const timesheet = mockXeroClient.payrollNZApi.createTimesheet.mock.calls[0][1];
      expect(timesheet.payrollCalendarID).toBe("cal-1");
      expect(timesheet.employeeID).toBe("emp-1");
    });

    it("maps timesheetLines with date and single numberOfUnits", async () => {
      mockXeroClient.payrollNZApi.createTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-new" } },
      });

      await createXeroPayrollTimesheet({
        employeeID: "emp-1",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        payrollCalendarID: "cal-1",
        timesheetLines: [
          { earningsRateID: "rate-1", numberOfUnits: 8, date: "2024-01-01" },
        ],
      });

      const timesheet = mockXeroClient.payrollNZApi.createTimesheet.mock.calls[0][1];
      expect(timesheet.timesheetLines[0].date).toBe("2024-01-01");
      expect(timesheet.timesheetLines[0].numberOfUnits).toBe(8);
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.createTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.createTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-new" } },
      });

      await createXeroPayrollTimesheet({
        employeeID: "emp-1",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        payrollCalendarID: "cal-1",
      });

      expect(mockXeroClient.payrollUKApi.createTimesheet).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.createTimesheet).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("AU");
    mockXeroClient.payrollAUV2Api.createTimesheet.mockRejectedValue(new Error("Validation failed"));

    const result = await createXeroPayrollTimesheet({
      employeeID: "emp-1",
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      payrollCalendarID: "cal-1",
    });

    expect(result.isError).toBe(true);
    expect(result.error).toBe("Validation failed");
  });
});
