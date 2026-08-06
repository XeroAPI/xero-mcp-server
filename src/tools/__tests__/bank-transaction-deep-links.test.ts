import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBankTransaction: vi.fn(),
  updateBankTransaction: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-bank-transaction.handler.js", () => ({
  createXeroBankTransaction: mocks.createBankTransaction,
}));

vi.mock("../../handlers/update-xero-bank-transaction.handler.js", () => ({
  updateXeroBankTransaction: mocks.updateBankTransaction,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { BANK_TRANSACTION: "BANK_TRANSACTION" },
  getDeepLink: mocks.getDeepLink,
}));

import CreateBankTransactionTool from "../create/create-bank-transaction.tool.js";
import UpdateBankTransactionTool from "../update/update-bank-transaction.tool.js";

const bankTransaction = {
  bankTransactionID: "transaction-id",
  date: "2026-08-06",
  contact: { name: "Example contact" },
  total: 42,
  status: "AUTHORISED",
};

describe("bank transaction tool deep links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeepLink.mockResolvedValue("https://go.xero.com/bank-transaction");
  });

  it("returns an organisation-scoped link after creating a transaction", async () => {
    mocks.createBankTransaction.mockResolvedValue({
      isError: false,
      result: bankTransaction,
    });

    const result = await CreateBankTransactionTool().handler({
      type: "RECEIVE",
      bankAccountId: "account-id",
      contactId: "contact-id",
      lineItems: [],
    }, {} as never);

    expect(mocks.getDeepLink).toHaveBeenCalledWith("BANK_TRANSACTION", "transaction-id");
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Link to view: https://go.xero.com/bank-transaction"),
    });
  });

  it("returns an organisation-scoped link after updating a transaction", async () => {
    mocks.updateBankTransaction.mockResolvedValue({
      isError: false,
      result: bankTransaction,
    });

    const result = await UpdateBankTransactionTool().handler({
      bankTransactionId: "transaction-id",
    }, {} as never);

    expect(mocks.getDeepLink).toHaveBeenCalledWith("BANK_TRANSACTION", "transaction-id");
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Link to view: https://go.xero.com/bank-transaction"),
    });
  });
});
