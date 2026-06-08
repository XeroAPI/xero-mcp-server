import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { deleteTimesheet: vi.fn() },
    payrollNZApi: { deleteTimesheet: vi.fn() },
    payrollUKApi: { deleteTimesheet: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { deleteXeroPayrollTimesheet } from "../delete-xero-payroll-timesheet.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteXeroPayrollTimesheet", () => {
  describe("AU region", () => {
    it("calls payrollAUV2Api.deleteTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
      mockXeroClient.payrollAUV2Api.deleteTimesheet.mockResolvedValue({});

      const result = await deleteXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollAUV2Api.deleteTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(result.isError).toBe(false);
      expect(result.result).toBe(true);
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.deleteTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.deleteTimesheet.mockResolvedValue({});

      const result = await deleteXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollNZApi.deleteTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(result.isError).toBe(false);
      expect(result.result).toBe(true);
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.deleteTimesheet", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.deleteTimesheet.mockResolvedValue({});

      const result = await deleteXeroPayrollTimesheet("ts-1");

      expect(mockXeroClient.payrollUKApi.deleteTimesheet).toHaveBeenCalledWith("test-tenant-id", "ts-1");
      expect(mockXeroClient.payrollNZApi.deleteTimesheet).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.deleteTimesheet.mockRejectedValue(new Error("Cannot delete"));

    const result = await deleteXeroPayrollTimesheet("ts-1");
    expect(result.isError).toBe(true);
    expect(result.error).toBe("Cannot delete");
  });
});
