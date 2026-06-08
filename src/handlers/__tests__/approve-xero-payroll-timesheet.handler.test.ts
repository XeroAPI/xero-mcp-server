import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { approveTimesheet: vi.fn() },
    payrollNZApi: { approveTimesheet: vi.fn() },
    payrollUKApi: { approveTimesheet: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { approveXeroPayrollTimesheet } from "../approve-xero-payroll-timesheet.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveXeroPayrollTimesheet", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUV2Api.approveTimesheet", async () => {
      mockXeroClient.payrollAUV2Api.approveTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1", status: "Approved" } },
      });

      const result = await approveXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollAUV2Api.approveTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(result.isError).toBe(false);
      expect(result.result?.timesheetID).toBe("ts-1");
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.approveTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.approveTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1" } },
      });

      await approveXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollNZApi.approveTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.approveTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.approveTimesheet.mockResolvedValue({
        body: { timesheet: { timesheetID: "ts-1" } },
      });

      await approveXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollUKApi.approveTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(mockXeroClient.payrollNZApi.approveTimesheet).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.approveTimesheet.mockRejectedValue(new Error("Already approved"));

    const result = await approveXeroPayrollTimesheet("ts-1");
    expect(result.isError).toBe(true);
    expect(result.error).toBe("Already approved");
  });
});
