import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollNZApi: { getEmployeeLeaveBalances: vi.fn() },
    payrollUKApi: { getEmployeeLeaveBalances: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPayrollEmployeeLeaveBalances } from "../list-xero-payroll-employee-leave-balances.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroPayrollEmployeeLeaveBalances", () => {
  it("returns isError for AU region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("AU");

    const result = await listXeroPayrollEmployeeLeaveBalances("emp-1");

    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/not supported for AU/);
    expect(mockXeroClient.payrollNZApi.getEmployeeLeaveBalances).not.toHaveBeenCalled();
    expect(mockXeroClient.payrollUKApi.getEmployeeLeaveBalances).not.toHaveBeenCalled();
  });

  it("calls payrollUKApi for UK region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("UK");
    mockXeroClient.payrollUKApi.getEmployeeLeaveBalances.mockResolvedValue({
      body: { leaveBalances: [{ leaveTypeID: "lt-1", name: "Annual", balance: 40 }] },
    });

    const result = await listXeroPayrollEmployeeLeaveBalances("emp-1");

    expect(mockXeroClient.payrollUKApi.getEmployeeLeaveBalances).toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.result![0].balance).toBe(40);
  });

  it("calls payrollNZApi for NZ region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.getEmployeeLeaveBalances.mockResolvedValue({
      body: { leaveBalances: [] },
    });

    const result = await listXeroPayrollEmployeeLeaveBalances("emp-1");

    expect(mockXeroClient.payrollNZApi.getEmployeeLeaveBalances).toHaveBeenCalled();
    expect(result.isError).toBe(false);
  });

  it("returns error when employeeId is empty", async () => {
    const result = await listXeroPayrollEmployeeLeaveBalances("");
    expect(result.isError).toBe(true);
  });
});
