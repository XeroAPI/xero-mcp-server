import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollNZApi: { getEmployeeLeaveTypes: vi.fn() },
    payrollUKApi: { getEmployeeLeaveTypes: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPayrollEmployeeLeaveTypes } from "../list-xero-payroll-employee-leave-types.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroPayrollEmployeeLeaveTypes", () => {
  it("returns isError for AU region", async () => {
    mockXeroClient.getRegion.mockResolvedValue("AU");

    const result = await listXeroPayrollEmployeeLeaveTypes("emp-1");

    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/not supported for AU/);
  });

  it("normalises UK hoursAccruedAnnually to unitsAccruedAnnually", async () => {
    mockXeroClient.getRegion.mockResolvedValue("UK");
    mockXeroClient.payrollUKApi.getEmployeeLeaveTypes.mockResolvedValue({
      body: {
        leaveTypes: [
          {
            leaveTypeID: "lt-1",
            scheduleOfAccrual: "BeginningOfCalendarYear",
            hoursAccruedAnnually: 160,
          },
        ],
      },
    });

    const result = await listXeroPayrollEmployeeLeaveTypes("emp-1");

    expect(mockXeroClient.payrollUKApi.getEmployeeLeaveTypes).toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.result![0].unitsAccruedAnnually).toBe(160);
  });

  it("preserves NZ unitsAccruedAnnually", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.getEmployeeLeaveTypes.mockResolvedValue({
      body: {
        leaveTypes: [
          {
            leaveTypeID: "lt-1",
            scheduleOfAccrual: "AnnuallyAfter6Months",
            unitsAccruedAnnually: 152,
          },
        ],
      },
    });

    const result = await listXeroPayrollEmployeeLeaveTypes("emp-1");

    expect(mockXeroClient.payrollNZApi.getEmployeeLeaveTypes).toHaveBeenCalled();
    expect(result.result![0].unitsAccruedAnnually).toBe(152);
  });
});
