import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticate, getOrganisations, getPayRun } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getOrganisations: vi.fn(),
  getPayRun: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-1",
    authenticate,
    accountingApi: { getOrganisations },
    payrollAUApi: { getPayRun },
  },
}));

import { resetPayrollRegionCache } from "../../helpers/get-payroll-region.js";
import { listXeroPayrollAuPayslips } from "../list-xero-payroll-au-payslips.handler.js";

describe("listXeroPayrollAuPayslips", () => {
  beforeEach(() => {
    resetPayrollRegionCache();
    authenticate.mockReset().mockResolvedValue(undefined);
    getOrganisations.mockReset();
    getPayRun.mockReset();
  });

  it("returns payslip summaries from the Payroll AU pay run, including super", async () => {
    getOrganisations.mockResolvedValue({
      body: { organisations: [{ countryCode: "AU" }] },
    });
    getPayRun.mockResolvedValue({
      body: {
        payRuns: [
          {
            payRunID: "pr-1",
            payslips: [
              {
                payslipID: "ps-1",
                employeeID: "au-1",
                firstName: "Alex",
                lastName: "Ng",
                wages: 1000,
                tax: 200,
                _super: 115,
                netPay: 800,
              },
            ],
          },
        ],
      },
    });

    const response = await listXeroPayrollAuPayslips("pr-1");

    expect(response.isError).toBe(false);
    if (response.isError) {
      throw new Error(response.error);
    }
    expect(getPayRun).toHaveBeenCalledWith(
      "tenant-1",
      "pr-1",
      expect.anything(),
    );
    expect(response.result).toEqual([
      expect.objectContaining({
        payslipID: "ps-1",
        _super: 115,
        netPay: 800,
      }),
    ]);
  });
});
