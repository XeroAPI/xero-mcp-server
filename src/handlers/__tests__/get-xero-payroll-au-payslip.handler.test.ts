import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticate, getOrganisations, getPayslip } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getOrganisations: vi.fn(),
  getPayslip: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-1",
    authenticate,
    accountingApi: { getOrganisations },
    payrollAUApi: { getPayslip },
  },
}));

import { resetPayrollRegionCache } from "../../helpers/get-payroll-region.js";
import { getXeroPayrollAuPayslip } from "../get-xero-payroll-au-payslip.handler.js";

describe("getXeroPayrollAuPayslip", () => {
  beforeEach(() => {
    resetPayrollRegionCache();
    authenticate.mockReset().mockResolvedValue(undefined);
    getOrganisations.mockReset();
    getPayslip.mockReset();
  });

  it("returns earnings and superannuation lines for an Australian payslip", async () => {
    getOrganisations.mockResolvedValue({
      body: { organisations: [{ countryCode: "AU" }] },
    });
    getPayslip.mockResolvedValue({
      body: {
        payslip: {
          payslipID: "ps-1",
          employeeID: "au-1",
          wages: 1000,
          _super: 115,
          earningsLines: [{ earningsRateID: "er-ord", amount: 1000 }],
          superannuationLines: [
            {
              superMembershipID: "sm-1",
              contributionType: "SGC",
              amount: 115,
            },
          ],
        },
      },
    });

    const response = await getXeroPayrollAuPayslip("ps-1");

    expect(response.isError).toBe(false);
    if (response.isError) {
      throw new Error(response.error);
    }
    expect(response.result?.superannuationLines).toEqual([
      expect.objectContaining({
        superMembershipID: "sm-1",
        amount: 115,
      }),
    ]);
  });

  it("refuses NZ organisations", async () => {
    getOrganisations.mockResolvedValue({
      body: { organisations: [{ countryCode: "NZ" }] },
    });

    const response = await getXeroPayrollAuPayslip("ps-1");

    expect(response.isError).toBe(true);
    expect(getPayslip).not.toHaveBeenCalled();
  });
});
