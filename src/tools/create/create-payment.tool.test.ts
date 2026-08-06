import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPayment: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-payment.handler.js", () => ({
  createXeroPayment: mocks.createPayment,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { PAYMENT: "PAYMENT" },
  getDeepLink: mocks.getDeepLink,
}));

import CreatePaymentTool from "./create-payment.tool.js";

describe("create-payment tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeepLink.mockResolvedValue("https://go.xero.com/payment");
  });

  it("forwards a credit note target and identifies the created payment", async () => {
    mocks.createPayment.mockResolvedValue({
      isError: false,
      result: {
        paymentID: "payment-id",
        creditNoteNumber: "CN-001",
        amount: 10,
        bankAmount: 15,
        currencyRate: 1.5,
        isReconciled: true,
        status: "AUTHORISED",
      },
    });

    const result = await CreatePaymentTool().handler({
      creditNoteId: "credit-note-id",
      accountId: "account-id",
      amount: 10,
      idempotencyKey: "payment-retry-key",
      isReconciled: true,
    }, {} as never);

    expect(mocks.createPayment).toHaveBeenCalledWith({
      creditNoteId: "credit-note-id",
      invoiceId: undefined,
      prepaymentId: undefined,
      overpaymentId: undefined,
      accountId: "account-id",
      amount: 10,
      bankAmount: undefined,
      isReconciled: true,
      date: undefined,
      reference: undefined,
      idempotencyKey: "payment-retry-key",
    });
    expect(result.content[0]).toEqual({
      type: "text",
      text: [
        "Payment created successfully:",
        "ID: payment-id",
        "Credit Note Number: CN-001",
        "Amount: 10",
        "Bank Amount: 15",
        "Currency Rate: 1.5",
        "Reconciled: Yes",
        "Status: AUTHORISED",
        "Link to view: https://go.xero.com/payment",
      ].join("\n"),
    });
  });

  it("limits idempotency keys to Xero's supported length", () => {
    const schema = z.object(CreatePaymentTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      invoiceId: "invoice-id",
      accountId: "account-id",
      amount: 10,
      idempotencyKey: "x".repeat(128),
    }).success).toBe(true);
    expect(schema.safeParse({
      invoiceId: "invoice-id",
      accountId: "account-id",
      amount: 10,
      idempotencyKey: "x".repeat(129),
    }).success).toBe(false);
    expect(schema.safeParse({
      invoiceId: "invoice-id",
      accountId: "account-id",
      amount: 10,
      bankAmount: 0,
    }).success).toBe(false);
  });

  it("forwards a bank-currency amount for foreign-currency payments", async () => {
    mocks.createPayment.mockResolvedValue({
      isError: false,
      result: {
        paymentID: "payment-id",
        amount: 100,
        bankAmount: 150,
        currencyRate: 1.5,
        status: "AUTHORISED",
      },
    });

    await CreatePaymentTool().handler({
      invoiceId: "invoice-id",
      accountId: "bank-account-id",
      amount: 100,
      bankAmount: 150,
    }, {} as never);

    expect(mocks.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      invoiceId: "invoice-id",
      accountId: "bank-account-id",
      amount: 100,
      bankAmount: 150,
    }));
  });
});
