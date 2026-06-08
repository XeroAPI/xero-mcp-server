import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollNZApi: { getEmployeeLeavePeriods: vi.fn() },
    payrollUKApi: { getEmployeeLeavePeriods: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPayrollLeavePeriods } from "../list-xero-payroll-leave-periods.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroPayrollLeavePeriods", () => {
  it("returns isError for AU region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("AU");

    const result = await listXeroPayrollLeavePeriods("emp-1");

    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/not supported for AU/);
  });

  it("calls payrollUKApi for UK region with date range", async () => {
    mockXeroClient.getRegion.mockResolvedValue("UK");
    mockXeroClient.payrollUKApi.getEmployeeLeavePeriods.mockResolvedValue({
      body: { periods: [{ periodStatus: "Approved", periodStartDate: "2026-01-01" }] },
    });

    const result = await listXeroPayrollLeavePeriods(
      "emp-1",
      "2026-01-01",
      "2026-12-31",
    );

    expect(mockXeroClient.payrollUKApi.getEmployeeLeavePeriods).toHaveBeenCalledWith(
      "test-tenant-id",
      "emp-1",
      "2026-01-01",
      "2026-12-31",
      expect.anything(),
    );
    expect(result.isError).toBe(false);
    expect(result.result).toHaveLength(1);
  });

  it("calls payrollNZApi for NZ region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.getEmployeeLeavePeriods.mockResolvedValue({
      body: { periods: [] },
    });

    const result = await listXeroPayrollLeavePeriods("emp-1");

    expect(mockXeroClient.payrollNZApi.getEmployeeLeavePeriods).toHaveBeenCalled();
    expect(result.isError).toBe(false);
  });
});
