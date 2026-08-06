import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createBankTransactions: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createBankTransactions: mocks.createBankTransactions,
    },
  },
}));

import { createXeroBankTransaction } from "../create-xero-bank-transaction.handler.js";

describe("createXeroBankTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits a contact when the bank transaction has none", async () => {
    mocks.createBankTransactions.mockResolvedValue({
      body: { bankTransactions: [{ bankTransactionID: "bank-transaction-id" }] },
    });

    const result = await createXeroBankTransaction(
      "SPEND",
      "bank-account-id",
      undefined,
      [{ description: "Bank fee" }],
    );

    expect(result).toMatchObject({ isError: false, error: null });
    const bankTransaction = mocks.createBankTransactions.mock.calls[0]?.[1].bankTransactions[0];
    expect(bankTransaction).toMatchObject({
      bankAccount: { accountID: "bank-account-id" },
      lineItems: [{ description: "Bank fee" }],
    });
    expect(bankTransaction).not.toHaveProperty("contact");
  });

  it("sets the requested reconciliation state", async () => {
    mocks.createBankTransactions.mockResolvedValue({
      body: { bankTransactions: [{ bankTransactionID: "bank-transaction-id" }] },
    });

    await createXeroBankTransaction(
      "SPEND",
      "bank-account-id",
      undefined,
      [{ description: "Bank fee" }],
      undefined,
      undefined,
      true,
    );

    const bankTransaction = mocks.createBankTransactions.mock.calls[0]?.[1].bankTransactions[0];
    expect(bankTransaction).toHaveProperty("isReconciled", true);
  });

  it("forwards an idempotency key for safe retries", async () => {
    mocks.createBankTransactions.mockResolvedValue({
      body: { bankTransactions: [{ bankTransactionID: "bank-transaction-id" }] },
    });

    await createXeroBankTransaction(
      "SPEND",
      "bank-account-id",
      undefined,
      [{ description: "Bank fee" }],
      undefined,
      undefined,
      undefined,
      "bank-transaction-retry-key",
    );

    expect(mocks.createBankTransactions.mock.calls[0][4]).toBe(
      "bank-transaction-retry-key",
    );
  });
});
