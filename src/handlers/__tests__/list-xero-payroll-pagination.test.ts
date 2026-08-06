import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getEmployees: vi.fn(),
  getLeaveTypes: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    payrollNZApi: {
      getEmployees: mocks.getEmployees,
      getLeaveTypes: mocks.getLeaveTypes,
    },
  },
}));

import { listXeroPayrollEmployees } from "../list-xero-payroll-employees.handler.js";
import { listXeroPayrollLeaveTypes } from "../list-xero-payroll-leave-types.handler.js";

describe("payroll list pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes an employee page to the Payroll NZ API", async () => {
    mocks.getEmployees.mockResolvedValue({ body: { employees: [] } });

    const result = await listXeroPayrollEmployees(2);

    expect(result).toMatchObject({ result: [], isError: false, error: null });
    expect(mocks.getEmployees).toHaveBeenCalledWith(
      "tenant-id",
      undefined,
      2,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("passes a leave-type page to the Payroll NZ API", async () => {
    mocks.getLeaveTypes.mockResolvedValue({ body: { leaveTypes: [] } });

    const result = await listXeroPayrollLeaveTypes(3);

    expect(result).toMatchObject({ result: [], isError: false, error: null });
    expect(mocks.getLeaveTypes).toHaveBeenCalledWith(
      "tenant-id",
      3,
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
