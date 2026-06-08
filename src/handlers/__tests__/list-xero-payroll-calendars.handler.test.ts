import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUApi: { getPayrollCalendars: vi.fn() },
    payrollNZApi: { getPayRunCalendars: vi.fn() },
    payrollUKApi: { getPayRunCalendars: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPayrollCalendars } from "../list-xero-payroll-calendars.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroPayrollCalendars", () => {
  describe("AU region", () => {
    beforeEach(() => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
    });

    it("calls payrollAUApi.getPayrollCalendars and maps fields", async () => {
      mockXeroClient.payrollAUApi.getPayrollCalendars.mockResolvedValue({
        body: {
          payrollCalendars: [
            {
              payrollCalendarID: "cal-1",
              name: "Weekly",
              calendarType: "WEEKLY",
              startDate: "2024-01-15",
              paymentDate: "2024-01-22",
            },
          ],
        },
      });

      const result = await listXeroPayrollCalendars({});

      expect(mockXeroClient.payrollAUApi.getPayrollCalendars).toHaveBeenCalledWith(
        "test-tenant-id",
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result.isError).toBe(false);
      expect(result.result).toHaveLength(1);
      expect(result.result![0].periodStartDate).toBe("2024-01-15");
      expect(result.result![0].paymentDate).toBe("2024-01-22");
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.getPayRunCalendars", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.getPayRunCalendars.mockResolvedValue({
        body: {
          payRunCalendars: [
            {
              payrollCalendarID: "cal-1",
              name: "Monthly",
              calendarType: "MONTHLY",
              periodStartDate: "2024-01-01",
              periodEndDate: "2024-01-31",
              paymentDate: "2024-02-01",
            },
          ],
        },
      });

      const result = await listXeroPayrollCalendars({});

      expect(mockXeroClient.payrollNZApi.getPayRunCalendars).toHaveBeenCalledWith("test-tenant-id", undefined);
      expect(result.isError).toBe(false);
      expect(result.result![0].periodStartDate).toBe("2024-01-01");
      expect(result.result![0].periodEndDate).toBe("2024-01-31");
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.getPayRunCalendars", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.getPayRunCalendars.mockResolvedValue({
        body: { payRunCalendars: [] },
      });

      await listXeroPayrollCalendars({});

      expect(mockXeroClient.payrollUKApi.getPayRunCalendars).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.getPayRunCalendars).not.toHaveBeenCalled();
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("AU");
    mockXeroClient.payrollAUApi.getPayrollCalendars.mockRejectedValue(new Error("Unauthorized"));

    const result = await listXeroPayrollCalendars({});
    expect(result.isError).toBe(true);
    expect(result.error).toBe("Unauthorized");
  });
});
