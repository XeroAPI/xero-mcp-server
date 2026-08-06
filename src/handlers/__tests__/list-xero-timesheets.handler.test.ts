import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getTimesheets: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    payrollNZApi: {
      getTimesheets: mocks.getTimesheets,
    },
  },
}));

import { listXeroPayrollTimesheets } from "../list-xero-timesheets.handler.js";

describe("listXeroPayrollTimesheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTimesheets.mockResolvedValue({ body: { timesheets: [] } });
  });

  it("forwards the requested page to the Payroll NZ API", async () => {
    await listXeroPayrollTimesheets(2);

    expect(mocks.getTimesheets).toHaveBeenCalledWith("tenant-id", 2, undefined);
  });
});
