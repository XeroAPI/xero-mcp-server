import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockPayrollNZApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { updateXeroPayrollEmployeeLeave } from "./update-xero-payroll-employee-leave.handler.js";
import { resetPayrollRegionCache } from "../helpers/get-payroll-region.js";

const existingLeave = {
  leaveID: "leave-1",
  leaveTypeID: "type-1",
  description: "Annual leave",
  startDate: "2026-09-01",
  endDate: "2026-09-05",
  periods: [
    {
      periodStartDate: "2026-09-01",
      periodEndDate: "2026-09-05",
      numberOfUnits: 40,
    },
  ],
};

const updatedLeave = {
  ...existingLeave,
  endDate: "2026-09-08",
};

describe("updateXeroPayrollEmployeeLeave", () => {
  beforeEach(() => {
    resetXeroClientMocks();
    resetPayrollRegionCache();
    mockAccountingApi.getOrganisations.mockResolvedValue({
      body: { organisations: [{ countryCode: "NZ" }] },
    });
    mockPayrollNZApi.getEmployeeLeaves.mockResolvedValue({
      body: { leave: [existingLeave] },
    });
  });

  it("merges partial fields onto the existing leave before PUT", async () => {
    mockPayrollNZApi.updateEmployeeLeave.mockResolvedValue({
      body: { leave: updatedLeave },
    });

    const result = await updateXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "leave-1",
      endDate: "2026-09-08",
    });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(updatedLeave);
    expect(mockPayrollNZApi.getEmployeeLeaves).toHaveBeenCalledWith(
      "tenant-1",
      "emp-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
    expect(mockPayrollNZApi.updateEmployeeLeave).toHaveBeenCalledWith(
      "tenant-1",
      "emp-1",
      "leave-1",
      {
        leaveTypeID: "type-1",
        description: "Annual leave",
        startDate: "2026-09-01",
        endDate: "2026-09-08",
      },
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("forwards periods when they are provided", async () => {
    mockPayrollNZApi.updateEmployeeLeave.mockResolvedValue({
      body: { leave: updatedLeave },
    });

    const periods = [
      {
        periodStartDate: "2026-09-01",
        periodEndDate: "2026-09-08",
        numberOfUnits: 48,
      },
    ];

    await updateXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "leave-1",
      periods,
    });

    const employeeLeave = mockPayrollNZApi.updateEmployeeLeave.mock.calls[0][3];
    expect(employeeLeave.periods).toEqual(periods);
  });

  it("returns an error when the leave is not in the employee's records", async () => {
    const result = await updateXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "missing",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Leave missing was not found for employee emp-1.",
    });
    expect(mockPayrollNZApi.updateEmployeeLeave).not.toHaveBeenCalled();
  });

  it("returns an error when Xero omits the updated leave", async () => {
    mockPayrollNZApi.updateEmployeeLeave.mockResolvedValue({ body: {} });

    const result = await updateXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "leave-1",
      description: "Updated description",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Leave update failed.",
    });
  });

  it("returns a formatted error when the update call fails", async () => {
    mockPayrollNZApi.updateEmployeeLeave.mockRejectedValue(
      new Error("cannot update completed leave"),
    );

    const result = await updateXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "leave-1",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "cannot update completed leave",
    });
  });
});
