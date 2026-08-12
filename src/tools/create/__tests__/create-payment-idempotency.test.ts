import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveIdempotencyKey } from "../../../helpers/idempotency-key.js";

const mocks = vi.hoisted(() => ({
  createXeroPayment: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../../handlers/create-xero-payment.handler.js", () => ({
  createXeroPayment: mocks.createXeroPayment,
}));

vi.mock("../../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { PAYMENT: "PAYMENT" },
  getDeepLink: mocks.getDeepLink,
}));

const { default: CreatePaymentTool } =
  await import("../create-payment.tool.js");

type PaymentArgs = {
  invoiceId: string;
  accountId: string;
  amount: number;
  date?: string;
  reference?: string;
  idempotencyKey?: string;
};

type PaymentHandler = (
  args: PaymentArgs,
  extra: { requestId: string },
) => Promise<unknown>;

const paymentHandler = CreatePaymentTool().handler as unknown as PaymentHandler;
const paymentArgs: PaymentArgs = {
  invoiceId: "invoice-id",
  accountId: "account-id",
  amount: 42,
};

describe("create-payment idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createXeroPayment.mockResolvedValue({
      isError: false,
      error: null,
      result: { paymentID: "payment-id" },
    });
    mocks.getDeepLink.mockResolvedValue(null);
  });

  it("uses the same request-bound key when the same MCP call is replayed", async () => {
    const extra = { requestId: "request-1" };

    await paymentHandler(paymentArgs, extra);
    await paymentHandler(paymentArgs, extra);

    const expectedKey = resolveIdempotencyKey(
      "create-payment",
      "request-1",
      undefined,
      undefined,
      paymentArgs,
    );
    expect(mocks.createXeroPayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ idempotencyKey: expectedKey }),
    );
    expect(mocks.createXeroPayment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ idempotencyKey: expectedKey }),
    );
  });

  it("passes a caller key through unchanged for retries with a new request ID", async () => {
    await paymentHandler(
      { ...paymentArgs, idempotencyKey: "caller-retry-key" },
      { requestId: "new-request-id" },
    );

    expect(mocks.createXeroPayment).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "caller-retry-key" }),
    );
  });
});
