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
        status: "AUTHORISED",
      },
    });

    const result = await CreatePaymentTool().handler({
      creditNoteId: "credit-note-id",
      accountId: "account-id",
      amount: 10,
    }, {} as never);

    expect(mocks.createPayment).toHaveBeenCalledWith({
      creditNoteId: "credit-note-id",
      invoiceId: undefined,
      accountId: "account-id",
      amount: 10,
      date: undefined,
      reference: undefined,
    });
    expect(result.content[0]).toEqual({
      type: "text",
      text: [
        "Payment created successfully:",
        "ID: payment-id",
        "Credit Note Number: CN-001",
        "Amount: 10",
        "Status: AUTHORISED",
        "Link to view: https://go.xero.com/payment",
      ].join("\n"),
    });
  });
});
