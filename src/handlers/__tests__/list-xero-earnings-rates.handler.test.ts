import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUApi: { getPayItems: vi.fn() },
    payrollNZApi: { getEarningsRates: vi.fn() },
    payrollUKApi: { getEarningsRates: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroEarningsRates } from "../list-xero-earnings-rates.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroEarningsRates", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUApi.getPayItems and extracts earningsRates", async () => {
      mockXeroClient.payrollAUApi.getPayItems.mockResolvedValue({
        body: {
          payItems: {
            earningsRates: [
              {
                earningsRateID: "rate-1",
                name: "Regular Hours",
                earningsType: "ORDINARYTIMEEARNINGS",
                rateType: "RATEPERUNIT",
                ratePerUnit: 25.0,
              },
              {
                earningsRateID: "rate-2",
                name: "Overtime",
                earningsType: "OVERTIMEEARNINGS",
                rateType: "RATEPERUNIT",
                ratePerUnit: 37.5,
              },
            ],
            deductionTypes: [],
            leaveTypes: [],
          },
        },
      });

      const result = await listXeroEarningsRates({});

      expect(mockXeroClient.payrollAUApi.getPayItems).toHaveBeenCalled();
      expect(result.isError).toBe(false);
      expect(result.result).toHaveLength(2);
      expect(result.result![0].name).toBe("Regular Hours");
      expect(result.result![1].name).toBe("Overtime");
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.getEarningsRates", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.getEarningsRates.mockResolvedValue({
        body: {
          earningsRates: [
            {
              earningsRateID: "rate-1",
              name: "Ordinary Time",
              earningsType: "RegularEarnings",
              rateType: "RatePerUnit",
              ratePerUnit: 30.0,
            },
          ],
        },
      });

      const result = await listXeroEarningsRates({});

      expect(mockXeroClient.payrollNZApi.getEarningsRates).toHaveBeenCalledWith("test-tenant-id", undefined);
      expect(result.isError).toBe(false);
      expect(result.result).toHaveLength(1);
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.getEarningsRates", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.getEarningsRates.mockResolvedValue({
        body: { earningsRates: [] },
      });

      await listXeroEarningsRates({});

      expect(mockXeroClient.payrollUKApi.getEarningsRates).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.getEarningsRates).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.getEarningsRates.mockRejectedValue(new Error("API error"));

    const result = await listXeroEarningsRates({});
    expect(result.isError).toBe(true);
    expect(result.error).toBe("API error");
  });
});
