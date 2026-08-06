import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: vi.fn(),
    accountingApi: {
      getReportProfitAndLoss: vi.fn(),
    },
  },
}));

import { xeroClient } from "../../clients/xero-client.js";
import { listXeroProfitAndLoss } from "../list-xero-profit-and-loss.handler.js";

const getReportProfitAndLoss = vi.mocked(
  xeroClient.accountingApi.getReportProfitAndLoss,
);

describe("listXeroProfitAndLoss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReportProfitAndLoss.mockResolvedValue({
      body: { reports: [{}] },
    } as never);
  });

  it("passes standardLayout and paymentsOnly to their respective API parameters", async () => {
    await listXeroProfitAndLoss(
      "2025-01-01",
      "2025-01-31",
      1,
      "MONTH",
      false,
      true,
    );

    expect(getReportProfitAndLoss).toHaveBeenCalledWith(
      "tenant-id",
      "2025-01-01",
      "2025-01-31",
      1,
      "MONTH",
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      true,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.any(String),
        }),
      }),
    );
  });
});
