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

import { deleteXeroPayrollEmployeeLeave } from "./delete-xero-payroll-employee-leave.handler.js";
import { resetPayrollRegionCache } from "../helpers/get-payroll-region.js";

describe("deleteXeroPayrollEmployeeLeave", () => {
  beforeEach(() => {
    resetXeroClientMocks();
    resetPayrollRegionCache();
    mockAccountingApi.getOrganisations.mockResolvedValue({
      body: { organisations: [{ countryCode: "NZ" }] },
    });
  });

  it("deletes employee leave by employee and leave ID", async () => {
    mockPayrollNZApi.deleteEmployeeLeave.mockResolvedValue({
      body: {},
    });

    const result = await deleteXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "leave-1",
    });

    expect(result).toEqual({
      result: true,
      isError: false,
      error: null,
    });
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockPayrollNZApi.deleteEmployeeLeave).toHaveBeenCalledWith(
      "tenant-1",
      "emp-1",
      "leave-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("returns a formatted error when the delete call fails", async () => {
    mockPayrollNZApi.deleteEmployeeLeave.mockRejectedValue(
      new Error("cannot delete processed leave"),
    );

    const result = await deleteXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "leave-1",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "cannot delete processed leave",
    });
  });

  it("refuses organisations outside New Zealand", async () => {
    mockAccountingApi.getOrganisations.mockResolvedValue({
      body: { organisations: [{ countryCode: "AU" }] },
    });

    const result = await deleteXeroPayrollEmployeeLeave({
      employeeId: "emp-1",
      leaveId: "leave-1",
    });

    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/New Zealand organisations/);
    expect(mockPayrollNZApi.deleteEmployeeLeave).not.toHaveBeenCalled();
  });
});
