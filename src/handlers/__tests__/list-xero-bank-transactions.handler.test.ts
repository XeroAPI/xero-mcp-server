import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getBankTransactions: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getBankTransactions: mocks.getBankTransactions,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { listXeroBankTransactions } from "../list-xero-bank-transactions.handler.js";

describe("listXeroBankTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBankTransactions.mockResolvedValue({
      body: { bankTransactions: [] },
    });
  });

  it("uses a valid bank account UUID in the Xero where clause", async () => {
    const result = await listXeroBankTransactions(
      2,
      "123e4567-e89b-12d3-a456-426614174000",
    );

    expect(result).toMatchObject({ result: [], isError: false, error: null });
    expect(mocks.getBankTransactions).toHaveBeenCalledWith(
      "tenant-id",
      undefined,
      'BankAccount.AccountID=guid("123e4567-e89b-12d3-a456-426614174000")',
      "Date DESC",
      2,
      undefined,
      10,
      { headers: {} },
    );
  });

  it("rejects malformed bank account filters before querying Xero", async () => {
    const result = await listXeroBankTransactions(
      1,
      '123e4567-e89b-12d3-a456-426614174000") OR Status=="AUTHORISED',
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Bank account ID must be a valid UUID.",
    });
    expect(mocks.getBankTransactions).not.toHaveBeenCalled();
  });
});
