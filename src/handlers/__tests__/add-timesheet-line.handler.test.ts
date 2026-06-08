import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { createTimesheetLine: vi.fn() },
    payrollNZApi: { createTimesheetLine: vi.fn() },
    payrollUKApi: { createTimesheetLine: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { updateXeroPayrollTimesheetAddLine } from "../update-xero-payroll-timesheet-add-line.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateXeroPayrollTimesheetAddLine", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUV2Api.createTimesheetLine", async () => {
      mockXeroClient.payrollAUV2Api.createTimesheetLine.mockResolvedValue({
        body: { timesheetLine: { timesheetLineID: "line-1", earningsRateID: "rate-1" } },
      });

      const result = await updateXeroPayrollTimesheetAddLine({
        timesheetID: "ts-1",
        earningsRateID: "rate-1",
        numberOfUnits: 8,
        date: "2024-01-01",
      });

      expect(mockXeroClient.payrollAUV2Api.createTimesheetLine).toHaveBeenCalledWith(
        "test-tenant-id",
        "ts-1",
        expect.objectContaining({
          earningsRateID: "rate-1",
          numberOfUnits: 8,
          date: "2024-01-01",
        }),
      );
      expect(result.isError).toBe(false);
    });
  });

  describe("NZ region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
    });

    it("calls payrollNZApi.createTimesheetLine with date and single numberOfUnits", async () => {
      mockXeroClient.payrollNZApi.createTimesheetLine.mockResolvedValue({
        body: { timesheetLine: { timesheetLineID: "line-1" } },
      });

      await updateXeroPayrollTimesheetAddLine({
        timesheetID: "ts-1",
        earningsRateID: "rate-1",
        numberOfUnits: 8,
        date: "2024-01-01",
      });

      const line = mockXeroClient.payrollNZApi.createTimesheetLine.mock.calls[0][2];
      expect(line.earningsRateID).toBe("rate-1");
      expect(line.numberOfUnits).toBe(8);
      expect(line.date).toBe("2024-01-01");
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.createTimesheetLine", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.createTimesheetLine.mockResolvedValue({
        body: { timesheetLine: { timesheetLineID: "line-1" } },
      });

      await updateXeroPayrollTimesheetAddLine({
        timesheetID: "ts-1",
        earningsRateID: "rate-1",
        numberOfUnits: 8,
        date: "2024-01-01",
      });

      expect(mockXeroClient.payrollUKApi.createTimesheetLine).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.createTimesheetLine).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.createTimesheetLine.mockRejectedValue(new Error("Invalid line"));

    const result = await updateXeroPayrollTimesheetAddLine({
      timesheetID: "ts-1",
      earningsRateID: "rate-1",
      numberOfUnits: 8,
      date: "2024-01-01",
    });

    expect(result.isError).toBe(true);
    expect(result.error).toBe("Invalid line");
  });
});
