import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroPayments: vi.fn(),
}));

vi.mock("../../handlers/list-xero-payments.handler.js", () => ({
  listXeroPayments: mocks.listXeroPayments,
}));

import ListPaymentsTool from "./list-payments.tool.js";

describe("list-payments tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listXeroPayments.mockResolvedValue({
      result: [
        {
          paymentID: "credit-note-payment-id",
          date: "2026-08-06",
          amount: 50,
          bankAmount: 75,
          currencyRate: 1.5,
          account: { code: "090", accountID: "bank-account-id" },
          creditNote: {
            creditNoteID: "credit-note-id",
            creditNoteNumber: "CN-001",
            remainingCredit: 25,
          },
        },
        {
          paymentID: "prepayment-payment-id",
          date: "2026-08-06",
          amount: 25,
          invoiceNumber: "PP-001",
          prepayment: { prepaymentID: "prepayment-id" },
        },
        {
          paymentID: "overpayment-payment-id",
          date: "2026-08-06",
          amount: 10,
          overpayment: { overpaymentID: "overpayment-id" },
        },
      ],
      isError: false,
      error: null,
    });
  });

  it("renders payment targets that are not invoices", async () => {
    const result = await ListPaymentsTool().handler({ page: 1 }, {} as never);

    expect(result.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: expect.stringContaining("Account: 090 | bank-account-id") }),
      expect.objectContaining({ text: expect.stringContaining("Credit Note ID: credit-note-id") }),
      expect.objectContaining({ text: expect.stringContaining("Prepayment ID: prepayment-id") }),
      expect.objectContaining({ text: expect.stringContaining("Invoice Number: PP-001") }),
      expect.objectContaining({ text: expect.stringContaining("Overpayment ID: overpayment-id") }),
      expect.objectContaining({ text: expect.stringContaining("Bank Amount: 75") }),
      expect.objectContaining({ text: expect.stringContaining("Currency Rate: 1.5") }),
    ]));
  });

  it("requires UUIDs for payment and invoice ID filters", () => {
    const schema = z.object(ListPaymentsTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      paymentId: "123e4567-e89b-12d3-a456-426614174001",
    }).success).toBe(true);
    expect(schema.safeParse({ invoiceId: "not-a-uuid" }).success).toBe(false);
    expect(schema.safeParse({ paymentId: "not-a-uuid" }).success).toBe(false);
  });
});
