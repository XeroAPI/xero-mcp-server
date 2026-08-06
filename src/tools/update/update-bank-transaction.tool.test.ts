import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../handlers/update-xero-bank-transaction.handler.js", () => ({
  updateXeroBankTransaction: vi.fn(),
}));

import { updateXeroBankTransaction } from "../../handlers/update-xero-bank-transaction.handler.js";
import UpdateBankTransactionTool from "./update-bank-transaction.tool.js";

const updateBankTransaction = vi.mocked(updateXeroBankTransaction);

describe("update-bank-transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateBankTransaction.mockResolvedValue({
      result: {
        bankTransactionID: "bank-transaction-id",
        bankAccount: { accountID: "bank-account-id" },
      },
      isError: false,
      error: null,
    } as never);
  });

  it("forwards an idempotency key for safe retries", async () => {
    await UpdateBankTransactionTool().handler({
      bankTransactionId: "bank-transaction-id",
      idempotencyKey: "bank-transaction-update-retry-key",
    }, {} as never);

    expect(updateBankTransaction).toHaveBeenCalledWith(
      "bank-transaction-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "bank-transaction-update-retry-key",
    );
  });
});
