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
      date: undefined,
    });
    expect(payment).not.toHaveProperty("invoice");
  });

  it("uses the prepayment identifier when refunding a prepayment", async () => {
    const result = await createXeroPayment({
      prepaymentId: "prepayment-id",
      accountId: "account-id",
      amount: 10,
    });

    expect(result.isError).toBe(false);
    const payment = mocks.createPayment.mock.calls[0][1];
    expect(payment).toMatchObject({
      prepayment: { prepaymentID: "prepayment-id" },
    });
    expect(payment).not.toHaveProperty("invoice");
  });

  it("uses the overpayment identifier when refunding an overpayment", async () => {
    const result = await createXeroPayment({
      overpaymentId: "overpayment-id",
      accountId: "account-id",
      amount: 10,
    });

    expect(result.isError).toBe(false);
    const payment = mocks.createPayment.mock.calls[0][1];
    expect(payment).toMatchObject({
      overpayment: { overpaymentID: "overpayment-id" },
    });
    expect(payment).not.toHaveProperty("invoice");
  });

  it("forwards an idempotency key for safe retries", async () => {
    const result = await createXeroPayment({
      invoiceId: "invoice-id",
      accountId: "account-id",
      amount: 10,
      idempotencyKey: "payment-retry-key",
    });

    expect(result.isError).toBe(false);
    expect(mocks.createPayment.mock.calls[0][2]).toBe("payment-retry-key");
  });

  it("sends the bank-currency amount for foreign-currency reconciliation", async () => {
    const result = await createXeroPayment({
      invoiceId: "invoice-id",
      accountId: "bank-account-id",
      amount: 100,
      bankAmount: 150,
    });

    expect(result.isError).toBe(false);
    expect(mocks.createPayment.mock.calls[0][1]).toMatchObject({
      amount: 100,
      bankAmount: 150,
    });
  });

  it("preserves an explicit unreconciled state", async () => {
    const result = await createXeroPayment({
      invoiceId: "invoice-id",
      accountId: "bank-account-id",
      amount: 100,
      isReconciled: false,
    });

    expect(result.isError).toBe(false);
    expect(mocks.createPayment.mock.calls[0][1]).toMatchObject({
      isReconciled: false,
    });
  });

  it("returns a resolved Xero validation error instead of reporting a successful payment", async () => {
    mocks.createPayment.mockResolvedValue({
      body: {
        payments: [{
          validationErrors: [{ message: "Payment amount exceeds the amount due." }],
        }],
      },
    });

    const result = await createXeroPayment({
      invoiceId: "invoice-id",
      accountId: "bank-account-id",
      amount: 100,
    });

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Payment amount exceeds the amount due.",
    });
  });

  it("rejects a payment validation error without a message", async () => {
    mocks.createPayment.mockResolvedValue({
      body: { payments: [{ validationErrors: [{}] }] },
    });

    const result = await createXeroPayment({
      invoiceId: "invoice-id",
      accountId: "bank-account-id",
      amount: 100,
    });

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Xero returned a validation error.",
    });
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
      error: "Provide exactly one invoice, credit note, prepayment, or overpayment ID.",
    });
    expect(multipleTargets).toMatchObject({
      result: null,
      isError: true,
      error: "Provide exactly one invoice, credit note, prepayment, or overpayment ID.",
    });
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });
});
