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

import { createXeroPayrollEmployeeLeave } from "./create-xero-payroll-employee-leave.handler.js";
import { resetPayrollRegionCache } from "../helpers/get-payroll-region.js";

const createdLeave = {
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
      periodStatus: "Approved",
    },
  ],
};

const createParams = {
  employeeId: "emp-1",
  leaveTypeID: "type-1",
  description: "Annual leave",
  startDate: "2026-09-01",
  endDate: "2026-09-05",
};

describe("createXeroPayrollEmployeeLeave", () => {
  beforeEach(() => {
    resetXeroClientMocks();
    resetPayrollRegionCache();
    mockAccountingApi.getOrganisations.mockResolvedValue({
      body: { organisations: [{ countryCode: "NZ" }] },
    });
  });

  it("creates employee leave and returns the created record", async () => {
    mockPayrollNZApi.createEmployeeLeave.mockResolvedValue({
      body: { leave: createdLeave },
    });

    const result = await createXeroPayrollEmployeeLeave(createParams);

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(createdLeave);
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockPayrollNZApi.createEmployeeLeave).toHaveBeenCalledWith(
      "tenant-1",
      "emp-1",
      {
        leaveTypeID: "type-1",
        description: "Annual leave",
        startDate: "2026-09-01",
        endDate: "2026-09-05",
      },
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("forwards optional leave periods so units can be overridden", async () => {
    mockPayrollNZApi.createEmployeeLeave.mockResolvedValue({
      body: { leave: createdLeave },
    });

    const periods = [
      {
        periodStartDate: "2026-09-01",
        periodEndDate: "2026-09-05",
        numberOfUnits: 32,
      },
    ];

    await createXeroPayrollEmployeeLeave({
      ...createParams,
      periods,
    });

    const employeeLeave = mockPayrollNZApi.createEmployeeLeave.mock.calls[0][2];
    expect(employeeLeave.periods).toEqual(periods);
  });

  it("returns an error when Xero omits the created leave", async () => {
    mockPayrollNZApi.createEmployeeLeave.mockResolvedValue({ body: {} });

    const result = await createXeroPayrollEmployeeLeave(createParams);

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Leave creation failed.",
    });
  });

  it("returns a formatted error when the create call fails", async () => {
    mockPayrollNZApi.createEmployeeLeave.mockRejectedValue(
      new Error("leave setup is required"),
    );

    const result = await createXeroPayrollEmployeeLeave(createParams);

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "leave setup is required",
    });
  });
});
