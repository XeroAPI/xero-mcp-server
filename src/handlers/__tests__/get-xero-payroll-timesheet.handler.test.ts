import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { getTimesheet: vi.fn() },
    payrollNZApi: { getTimesheet: vi.fn() },
    payrollUKApi: { getTimesheet: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { getXeroPayrollTimesheet } from "../get-xero-payroll-timesheet.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getXeroPayrollTimesheet", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUV2Api.getTimesheet", async () => {
      mockXeroClient.payrollAUV2Api.getTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1", employeeID: "emp-1", startDate: "2024-01-01", endDate: "2024-01-07" } },
      });

      const result = await getXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollAUV2Api.getTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(result.isError).toBe(false);
      expect(result.result?.timesheetID).toBe("ts-1");
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.getTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.getTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1" } },
      });

      await getXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollNZApi.getTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.getTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.getTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1" } },
      });

      await getXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollUKApi.getTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(mockXeroClient.payrollNZApi.getTimesheet).not.toHaveBeenCalled();
    });
  });

  it("returns null when timesheet not found", async () => {
    mockXeroClient.getRegion.mockResolvedValue("AU");
    mockXeroClient.payrollAUV2Api.getTimesheet.mockResolvedValue({
      body: { timesheet: undefined },
    });

    const result = await getXeroPayrollTimesheet("nonexistent");
    expect(result.isError).toBe(false);
    expect(result.result).toBeNull();
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.getTimesheet.mockRejectedValue(new Error("Not found"));

    const result = await getXeroPayrollTimesheet("ts-1");
    expect(result.isError).toBe(true);
    expect(result.error).toBe("Not found");
  });
});
