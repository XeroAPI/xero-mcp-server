import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getBankTransaction: vi.fn(),
  updateBankTransaction: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getBankTransaction: mocks.getBankTransaction,
      updateBankTransaction: mocks.updateBankTransaction,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { updateXeroBankTransaction } from "../update-xero-bank-transaction.handler.js";

describe("updateXeroBankTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBankTransaction.mockResolvedValue({
      body: {
        bankTransactions: [{
          bankTransactionID: "bank-transaction-id",
          type: "SPEND",
          bankAccount: { accountID: "bank-account-id" },
          lineItems: [{ description: "Bank fee" }],
          isReconciled: true,
        }],
      },
    });
    mocks.updateBankTransaction.mockResolvedValue({
      body: { bankTransactions: [{ bankTransactionID: "bank-transaction-id" }] },
    });
  });

  it("preserves a requested unreconciled state", async () => {
    const result = await updateXeroBankTransaction(
      "bank-transaction-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );

    expect(result.isError).toBe(false);
    const bankTransaction = mocks.updateBankTransaction.mock.calls[0]?.[2].bankTransactions[0];
    expect(bankTransaction).toHaveProperty("isReconciled", false);
    expect(mocks.getBankTransaction.mock.calls[0][2]).toBe(4);
    expect(mocks.updateBankTransaction.mock.calls[0][3]).toBe(4);
  });

  it("returns a resolved Xero validation error instead of reporting a successful update", async () => {
    mocks.updateBankTransaction.mockResolvedValue({
      body: {
        bankTransactions: [{
          validationErrors: [{ message: "Bank account is required." }],
        }],
      },
    });

    const result = await updateXeroBankTransaction(
      "bank-transaction-id",
      undefined,
      undefined,
      undefined,
      "Updated reference",
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Bank account is required.",
    });
  });
});
