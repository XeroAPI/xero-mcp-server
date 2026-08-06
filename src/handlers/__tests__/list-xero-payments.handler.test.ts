import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getPayments: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getPayments: mocks.getPayments,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { listXeroPayments } from "../list-xero-payments.handler.js";

describe("listXeroPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPayments.mockResolvedValue({ body: { payments: [] } });
  });

  it("escapes quote and backslash characters in string filters", async () => {
    const result = await listXeroPayments(1, {
      invoiceNumber: 'INV"001',
      reference: "Ref\\Path",
    });

    expect(result).toMatchObject({ result: [], isError: false, error: null });
    expect(mocks.getPayments).toHaveBeenCalledWith(
      "tenant-id",
      undefined,
      'Invoice.InvoiceNumber=="INV\\"001" AND Reference=="Ref\\\\Path"',
      "UpdatedDateUTC DESC",
      1,
      10,
      { headers: {} },
    );
  });
});
