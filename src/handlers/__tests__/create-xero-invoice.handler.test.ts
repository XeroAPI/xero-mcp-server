import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("returns a resolved Xero validation error instead of reporting a successful creation", async () => {
    mocks.createInvoices.mockResolvedValue({
      body: {
        invoices: [{
          validationErrors: [{ message: "Account code is invalid." }],
        }],
      },
    });

    const result = await createXeroInvoice(
      "contact-id",
      [{
        description: "Consulting services",
        quantity: 1,
        unitAmount: 100,
        accountCode: "200",
        taxType: "OUTPUT",
      }],
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Account code is invalid.",
    });
  });
});
