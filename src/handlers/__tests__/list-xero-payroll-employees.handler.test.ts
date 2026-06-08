import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockXeroClient } = vi.hoisted(() => ({
  mockXeroClient: {
    authenticate: vi.fn(),
    getRegion: vi.fn(),
    tenantId: "test-tenant-id",
    payrollAUApi: { getEmployees: vi.fn() },
    payrollNZApi: { getEmployees: vi.fn() },
    payrollUKApi: { getEmployees: vi.fn() },
  },
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPayrollEmployees } from "../list-xero-payroll-employees.handler.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listXeroPayrollEmployees", () => {
  describe("AU region", () => {
    it("calls payrollAUApi.getEmployees and maps phone -> phoneNumber", async () => {
      mockXeroClient.getRegion.mockResolvedValue("AU");
      mockXeroClient.payrollAUApi.getEmployees.mockResolvedValue({
        body: {
          employees: [
            {
              employeeID: "au-1",
              firstName: "Alice",
              lastName: "Anderson",
              email: "alice@example.com",
              phone: "+61 400 000 000",
            },
          ],
        },
      });

      const result = await listXeroPayrollEmployees();

      expect(mockXeroClient.payrollAUApi.getEmployees).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.getEmployees).not.toHaveBeenCalled();
      expect(mockXeroClient.payrollUKApi.getEmployees).not.toHaveBeenCalled();
      expect(result.isError).toBe(false);
      expect(result.result).toHaveLength(1);
      expect(result.result![0].phoneNumber).toBe("+61 400 000 000");
    });
  });

  describe("UK region", () => {
    it("calls payrollUKApi.getEmployees", async () => {
      mockXeroClient.getRegion.mockResolvedValue("UK");
      mockXeroClient.payrollUKApi.getEmployees.mockResolvedValue({
        body: {
          employees: [
            {
              employeeID: "uk-1",
              firstName: "Bob",
              lastName: "Brown",
              phoneNumber: "+44 20 7946 0000",
            },
          ],
        },
      });

      const result = await listXeroPayrollEmployees();

      expect(mockXeroClient.payrollUKApi.getEmployees).toHaveBeenCalled();
      expect(mockXeroClient.payrollNZApi.getEmployees).not.toHaveBeenCalled();
      expect(mockXeroClient.payrollAUApi.getEmployees).not.toHaveBeenCalled();
      expect(result.isError).toBe(false);
      expect(result.result![0].phoneNumber).toBe("+44 20 7946 0000");
    });
  });

  describe("NZ region", () => {
    it("calls payrollNZApi.getEmployees and preserves engagementType", async () => {
      mockXeroClient.getRegion.mockResolvedValue("NZ");
      mockXeroClient.payrollNZApi.getEmployees.mockResolvedValue({
        body: {
          employees: [
            {
              employeeID: "nz-1",
              firstName: "Carol",
              lastName: "Carter",
              engagementType: "Permanent",
              phoneNumber: "+64 9 000 0000",
            },
          ],
        },
      });

      const result = await listXeroPayrollEmployees();

      expect(mockXeroClient.payrollNZApi.getEmployees).toHaveBeenCalled();
      expect(result.isError).toBe(false);
      expect(result.result![0].engagementType).toBe("Permanent");
    });
  });

  it("returns error response on API failure", async () => {
    mockXeroClient.getRegion.mockResolvedValue("NZ");
    mockXeroClient.payrollNZApi.getEmployees.mockRejectedValue(
      new Error("API error"),
    );

    const result = await listXeroPayrollEmployees();
    expect(result.isError).toBe(true);
    expect(result.error).toBe("API error");
  });
});
