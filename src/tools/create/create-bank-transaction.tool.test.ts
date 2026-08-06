import { LineAmountTypes } from "xero-node";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../handlers/create-xero-bank-transaction.handler.js", () => ({
  createXeroBankTransaction: vi.fn(),
}));

import { createXeroBankTransaction } from "../../handlers/create-xero-bank-transaction.handler.js";
import CreateBankTransactionTool from "./create-bank-transaction.tool.js";

const createBankTransaction = vi.mocked(createXeroBankTransaction);

describe("create-bank-transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBankTransaction.mockResolvedValue({
      result: {
        bankTransactionID: "bank-transaction-id",
        bankAccount: { accountID: "bank-account-id" },
      },
      isError: false,
      error: null,
    } as never);
  });

  it("forwards an explicitly supplied transaction date", async () => {
    await CreateBankTransactionTool().handler({
      type: "SPEND",
      bankAccountId: "bank-account-id",
      lineItems: [{ description: "Bank fee" }],
      date: "2026-08-06",
    }, {} as never);

    expect(createBankTransaction).toHaveBeenCalledWith(
      "SPEND",
      "bank-account-id",
      undefined,
      [{ description: "Bank fee" }],
      undefined,
      "2026-08-06",
      undefined,
      undefined,
      undefined,
    );
  });

  it("forwards the requested line amount tax treatment", async () => {
    await CreateBankTransactionTool().handler({
      type: "SPEND",
      bankAccountId: "bank-account-id",
      lineItems: [{ description: "Bank fee" }],
      lineAmountTypes: "Exclusive",
    }, {} as never);

    expect(createBankTransaction.mock.calls[0][8]).toBe(LineAmountTypes.Exclusive);
  });
});
