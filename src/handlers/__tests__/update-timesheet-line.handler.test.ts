import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { updateTimesheetLine: vi.fn() },
    payrollNZApi: { updateTimesheetLine: vi.fn() },
    payrollUKApi: { updateTimesheetLine: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { updateXeroPayrollTimesheetUpdateLine } from "../update-xero-payroll-timesheet-update-line.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateXeroPayrollTimesheetUpdateLine", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUV2Api.updateTimesheetLine with timesheetLineID", async () => {
      mockXeroClient.payrollAUV2Api.updateTimesheetLine.mockResolvedValue({
        body: { timesheetLine: { timesheetLineID: "line-1", earningsRateID: "rate-1" } },
      });

      const result = await updateXeroPayrollTimesheetUpdateLine({
        timesheetID: "ts-1",
        timesheetLineID: "line-1",
        earningsRateID: "rate-1",
        numberOfUnits: 6,
        date: "2024-01-01",
      });

      expect(mockXeroClient.payrollAUV2Api.updateTimesheetLine).toHaveBeenCalledWith(
        "test-tenant-id",
        "ts-1",
        "line-1",
        expect.objectContaining({
          earningsRateID: "rate-1",
          numberOfUnits: 6,
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

    it("calls payrollNZApi.updateTimesheetLine with timesheetLineID", async () => {
      mockXeroClient.payrollNZApi.updateTimesheetLine.mockResolvedValue({
        body: { timesheetLine: { timesheetLineID: "line-1" } },
      });

      await updateXeroPayrollTimesheetUpdateLine({
        timesheetID: "ts-1",
        timesheetLineID: "line-1",
        earningsRateID: "rate-1",
        numberOfUnits: 8,
        date: "2024-01-01",
      });

      expect(mockXeroClient.payrollNZApi.updateTimesheetLine).toHaveBeenCalledWith(
        "test-tenant-id",
        "ts-1",
        "line-1",
        expect.objectContaining({
          earningsRateID: "rate-1",
          numberOfUnits: 8,
          date: "2024-01-01",
        }),
      );
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.updateTimesheetLine", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.updateTimesheetLine.mockResolvedValue({
        body: { timesheetLine: { timesheetLineID: "line-1" } },
      });

      await updateXeroPayrollTimesheetUpdateLine({
        timesheetID: "ts-1",
        timesheetLineID: "line-1",
        earningsRateID: "rate-1",
        numberOfUnits: 8,
        date: "2024-01-01",
      });

      expect(mockXeroClient.payrollUKApi.updateTimesheetLine).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.updateTimesheetLine).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.updateTimesheetLine.mockRejectedValue(new Error("Line not found"));

    const result = await updateXeroPayrollTimesheetUpdateLine({
      timesheetID: "ts-1",
      timesheetLineID: "line-1",
      earningsRateID: "rate-1",
      numberOfUnits: 8,
      date: "2024-01-01",
    });

    expect(result.isError).toBe(true);
    expect(result.error).toBe("Line not found");
  });
});
