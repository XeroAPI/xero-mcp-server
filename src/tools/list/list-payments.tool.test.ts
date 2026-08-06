import { describe, expect, it, vi } from "vitest";
import { Payment } from "xero-node";

const mocks = vi.hoisted(() => ({
  listXeroPayments: vi.fn(),
}));

vi.mock("../../handlers/list-xero-payments.handler.js", () => ({
  listXeroPayments: mocks.listXeroPayments,
}));

import ListPaymentsTool from "./list-payments.tool.js";

describe("list-payments tool", () => {
  it("renders non-invoice payment documents", async () => {
    mocks.listXeroPayments.mockResolvedValue({
      result: [{
        paymentID: "payment-id",
        creditNote: { creditNoteID: "credit-note-id", creditNoteNumber: "CN-001" },
        prepayment: { prepaymentID: "prepayment-id" },
        overpayment: { overpaymentID: "overpayment-id" },
      } as Payment],
      isError: false,
      error: null,
    });

    const result = await ListPaymentsTool().handler({ page: 1 }, {} as never);
    const text = result.content.map((content) => content.type === "text" ? content.text : "").join("\n");

    expect(text).toContain("Credit Note ID: credit-note-id");
    expect(text).toContain("Prepayment ID: prepayment-id");
    expect(text).toContain("Overpayment ID: overpayment-id");
  });
});
