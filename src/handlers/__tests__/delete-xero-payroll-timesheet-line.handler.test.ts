import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { deleteTimesheetLine: vi.fn() },
    payrollNZApi: { deleteTimesheetLine: vi.fn() },
    payrollUKApi: { deleteTimesheetLine: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { deleteXeroPayrollTimesheetLine } from "../delete-xero-payroll-timesheet-line.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteXeroPayrollTimesheetLine", () => {
  describe("AU region", () => {
    it("calls payrollAUV2Api.deleteTimesheetLine", async () => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
      mockXeroClient.payrollAUV2Api.deleteTimesheetLine.mockResolvedValue({});

      const result = await deleteXeroPayrollTimesheetLine("ts-1", "line-1");

      expect(mockXeroClient.payrollAUV2Api.deleteTimesheetLine).toHaveBeenCalledWith("test-tenant-id", "ts-1", "line-1");
      expect(result.isError).toBe(false);
      expect(result.result).toBe(true);
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.deleteTimesheetLine", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.deleteTimesheetLine.mockResolvedValue({});

      const result = await deleteXeroPayrollTimesheetLine("ts-1", "line-1");

      expect(mockXeroClient.payrollNZApi.deleteTimesheetLine).toHaveBeenCalledWith("test-tenant-id", "ts-1", "line-1");
      expect(result.isError).toBe(false);
      expect(result.result).toBe(true);
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.deleteTimesheetLine", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.deleteTimesheetLine.mockResolvedValue({});

      const result = await deleteXeroPayrollTimesheetLine("ts-1", "line-1");

      expect(mockXeroClient.payrollUKApi.deleteTimesheetLine).toHaveBeenCalledWith("test-tenant-id", "ts-1", "line-1");
      expect(mockXeroClient.payrollNZApi.deleteTimesheetLine).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.deleteTimesheetLine.mockRejectedValue(new Error("Cannot delete line"));

    const result = await deleteXeroPayrollTimesheetLine("ts-1", "line-1");
    expect(result.isError).toBe(true);
    expect(result.error).toBe("Cannot delete line");
  });
});
