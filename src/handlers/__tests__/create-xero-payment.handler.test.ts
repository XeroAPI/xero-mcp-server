import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createPayment: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createPayment: mocks.createPayment,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroPayment } from "../create-xero-payment.handler.js";

describe("createXeroPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPayment.mockResolvedValue({
      body: { payments: [{ paymentID: "payment-id" }] },
    });
  });

  it("uses the credit note identifier when refunding a credit note", async () => {
    const result = await createXeroPayment({
      creditNoteId: "credit-note-id",
      accountId: "account-id",
      amount: 10,
    });

    expect(result.isError).toBe(false);
    const payment = mocks.createPayment.mock.calls[0][1];
    expect(payment).toMatchObject({
      creditNote: { creditNoteID: "credit-note-id" },
      account: { accountID: "account-id" },
      amount: 10,
    });
    expect(payment).not.toHaveProperty("invoice");
  });

  it("rejects missing or ambiguous payment targets before calling Xero", async () => {
    const missingTarget = await createXeroPayment({ accountId: "account-id", amount: 10 });
    const multipleTargets = await createXeroPayment({
      invoiceId: "invoice-id",
      creditNoteId: "credit-note-id",
      accountId: "account-id",
      amount: 10,
    });

    expect(missingTarget).toMatchObject({
      result: null,
      isError: true,
      error: "Provide exactly one invoice ID or credit note ID.",
    });
    expect(multipleTargets).toMatchObject({
      result: null,
      isError: true,
      error: "Provide exactly one invoice ID or credit note ID.",
    });
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });
});
