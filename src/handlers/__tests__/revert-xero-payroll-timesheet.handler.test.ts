import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { revertTimesheet: vi.fn() },
    payrollNZApi: { revertTimesheet: vi.fn() },
    payrollUKApi: { revertTimesheet: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { revertXeroPayrollTimesheet } from "../revert-xero-payroll-timesheet.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revertXeroPayrollTimesheet", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUV2Api.revertTimesheet", async () => {
      mockXeroClient.payrollAUV2Api.revertTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1", status: "Draft" } },
      });

      const result = await revertXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollAUV2Api.revertTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(result.isError).toBe(false);
      expect(result.result?.timesheetID).toBe("ts-1");
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.revertTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.revertTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1" } },
      });

      await revertXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollNZApi.revertTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.revertTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.revertTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1" } },
      });

      await revertXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollUKApi.revertTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(mockXeroClient.payrollNZApi.revertTimesheet).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.revertTimesheet.mockRejectedValue(new Error("Cannot revert"));

    const result = await revertXeroPayrollTimesheet("ts-1");
    expect(result.isError).toBe(true);
    expect(result.error).toBe("Cannot revert");
  });
});
