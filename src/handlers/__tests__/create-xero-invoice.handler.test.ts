import { beforeEach, describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createInvoices: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createInvoices: mocks.createInvoices,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroInvoice } from "../create-xero-invoice.handler.js";

describe("createXeroInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createInvoices.mockResolvedValue({
      body: { invoices: [{ invoiceID: "invoice-id" }] },
    });
  });

  it("forwards an idempotency key for safe retries", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [{ description: "Consulting services" }],
      Invoice.TypeEnum.ACCREC,
      undefined,
      undefined,
      "invoice-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createInvoices.mock.calls[0][4]).toBe("invoice-retry-key");
  });
});
