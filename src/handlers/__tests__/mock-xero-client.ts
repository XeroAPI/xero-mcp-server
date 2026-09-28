import { vi, type Mock } from "vitest";

// Each API method becomes a vi.fn on first use, so every feature's tests can
// share this mock without listing the methods they call.
function mockApi(): Record<string, Mock> {
  return new Proxy({} as Record<string, Mock>, {
    get: (fns, name) =>
      typeof name === "string" && name !== "then"
        ? (fns[name] ??= vi.fn())
        : undefined,
  });
}

export const mockAccountingApi = mockApi();
export const mockPayrollAUApi = mockApi();
export const mockPayrollNZApi = mockApi();

export const mockXeroClient = {
  authenticate: vi.fn().mockResolvedValue(undefined),
  tenantId: "tenant-1",
  accountingApi: mockAccountingApi,
  payrollAUApi: mockPayrollAUApi,
  payrollNZApi: mockPayrollNZApi,
  getShortCode: vi.fn().mockResolvedValue("!abc"),
};

export function resetXeroClientMocks() {
  mockXeroClient.authenticate.mockReset().mockResolvedValue(undefined);
  mockXeroClient.getShortCode.mockReset().mockResolvedValue("!abc");
  for (const api of [mockAccountingApi, mockPayrollAUApi, mockPayrollNZApi]) {
    for (const fn of Object.values(api)) {
      fn.mockReset();
    }
  }
}
