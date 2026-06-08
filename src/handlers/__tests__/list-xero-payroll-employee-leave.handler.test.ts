import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollNZApi: { getEmployeeLeaves: vi.fn() },
    payrollUKApi: { getEmployeeLeaves: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPayrollEmployeeLeave } from "../list-xero-payroll-employee-leave.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroPayrollEmployeeLeave", () => {
  it("returns isError for AU region without calling any API", async () => {
    mockXeroClient.getRegion.mockResolvedValue("AU");

    const result = await listXeroPayrollEmployeeLeave("emp-1");

    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/not supported for AU/);
    expect(mockXeroClient.payrollNZApi.getEmployeeLeaves).not.toHaveBeenCalled();
    expect(mockXeroClient.payrollUKApi.getEmployeeLeaves).not.toHaveBeenCalled();
  });

  it("calls payrollUKApi for UK region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("UK");
    mockXeroClient.payrollUKApi.getEmployeeLeaves.mockResolvedValue({
      body: { leave: [{ leaveID: "l-1", leaveTypeID: "lt-1", description: "Annual" }] },
    });

    const result = await listXeroPayrollEmployeeLeave("emp-1");

    expect(mockXeroClient.payrollUKApi.getEmployeeLeaves).toHaveBeenCalled();
    expect(mockXeroClient.payrollNZApi.getEmployeeLeaves).not.toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.result).toHaveLength(1);
  });

  it("calls payrollNZApi for NZ region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.getEmployeeLeaves.mockResolvedValue({
      body: { leave: [] },
    });

    const result = await listXeroPayrollEmployeeLeave("emp-1");

    expect(mockXeroClient.payrollNZApi.getEmployeeLeaves).toHaveBeenCalled();
    expect(result.isError).toBe(false);
  });

  it("returns error when employeeId is empty", async () => {
    const result = await listXeroPayrollEmployeeLeave("");
    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/Employee ID is required/);
  });
});
