import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUV2Api: { getTimesheets: vi.fn() },
    payrollNZApi: { getTimesheets: vi.fn() },
    payrollUKApi: { getTimesheets: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPayrollTimesheets } from "../list-xero-timesheets.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroPayrollTimesheets", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUV2Api.getTimesheets with v2 params", async () => {
      mockXeroClient.payrollAUV2Api.getTimesheets.mockResolvedValue({
        body: { timesheets: [] },
      });

      await listXeroPayrollTimesheets({
        page: 1,
        filter: "employeeId==abc-123",
        status: "Draft",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        sort: "startDate",
      });

      expect(mockXeroClient.payrollAUV2Api.getTimesheets).toHaveBeenCalledWith(
        "test-tenant-id",
        1,
        "employeeId==abc-123",
        "Draft",
        "2024-01-01",
        "2024-01-31",
        "startDate",
      );
    });

    it("returns AU timesheets on success", async () => {
      const auTimesheets = [
        { timesheetID: "ts-1", employeeID: "emp-1", startDate: "2024-01-01", endDate: "2024-01-07", totalHours: 40 },
      ];
      mockXeroClient.payrollAUV2Api.getTimesheets.mockResolvedValue({
        body: { timesheets: auTimesheets },
      });

      const result = await listXeroPayrollTimesheets({});
      expect(result.isError).toBe(false);
      expect(result.result).toEqual(auTimesheets);
    });
  });

  describe("NZ region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
    });

    it("calls payrollNZApi.getTimesheets with correct params", async () => {
      mockXeroClient.payrollNZApi.getTimesheets.mockResolvedValue({
        body: { timesheets: [] },
      });

      await listXeroPayrollTimesheets({
        page: 1,
        filter: "employeeId==abc-123",
        status: "Draft",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        sort: "startDate",
      });

      expect(mockXeroClient.payrollNZApi.getTimesheets).toHaveBeenCalledWith(
        "test-tenant-id",
        1,
        "employeeId==abc-123",
        "Draft",
        "2024-01-01",
        "2024-01-31",
        "startDate",
      );
    });

    it("returns NZ timesheets on success", async () => {
      const nzTimesheets = [
        { timesheetID: "ts-1", employeeID: "emp-1", startDate: "2024-01-01", endDate: "2024-01-07", totalHours: 40 },
      ];
      mockXeroClient.payrollNZApi.getTimesheets.mockResolvedValue({
        body: { timesheets: nzTimesheets },
      });

      const result = await listXeroPayrollTimesheets({});
      expect(result.isError).toBe(false);
      expect(result.result).toEqual(nzTimesheets);
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.getTimesheets", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.getTimesheets.mockResolvedValue({
        body: { timesheets: [] },
      });

      await listXeroPayrollTimesheets({ page: 1 });

      expect(mockXeroClient.payrollUKApi.getTimesheets).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.getTimesheets).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns error response on API failure", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.getTimesheets.mockRejectedValue(new Error("API down"));

      const result = await listXeroPayrollTimesheets({});
      expect(result.isError).toBe(true);
      expect(result.error).toBe("API down");
      expect(result.result).toBeNull();
    });
  });
});
