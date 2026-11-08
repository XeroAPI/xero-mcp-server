import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMock = vi.fn();
const getBankTransactionsMock = vi.fn();
const getBankTransactionMock = vi.fn();
const getClientHeadersMock = vi.fn(() => ({ "x-test": "header" }));

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-123",
    authenticate: authenticateMock,
    accountingApi: {
      getBankTransactions: getBankTransactionsMock,
      getBankTransaction: getBankTransactionMock,
    },
  },
}));

vi.mock("../helpers/get-client-headers.js", () => ({
  getClientHeaders: getClientHeadersMock,
}));

const ACCOUNT = "13918178-849a-4823-9a31-57b7eac713d7";
const TXN = "d20b6c54-7f5d-4ce6-ab83-55f609719126";

describe("listXeroBankTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBankTransactionsMock.mockResolvedValue({ body: { bankTransactions: [] } });
  });

  it("keeps the original defaults when no new options are given", async () => {
    const { listXeroBankTransactions } = await import(
      "./list-xero-bank-transactions.handler.js"
    );

    const result = await listXeroBankTransactions(1);

    expect(result.isError).toBe(false);
    expect(getBankTransactionsMock).toHaveBeenCalledWith(
      "tenant-123",
      undefined,
      undefined,
      "Date DESC",
      1,
      undefined,
      10,
      undefined,
      { "x-test": "header" },
    );
  });

  it("passes date range, order and page size through to the SDK", async () => {
    const { listXeroBankTransactions } = await import(
      "./list-xero-bank-transactions.handler.js"
    );

    await listXeroBankTransactions(2, ACCOUNT, {
      fromDate: "2026-07-01",
      toDate: "2026-09-30",
      order: "Date ASC",
      pageSize: 100,
    });

    expect(getBankTransactionsMock).toHaveBeenCalledWith(
      "tenant-123",
      undefined,
      `BankAccount.AccountID=guid("${ACCOUNT}") && Date >= DateTime(2026,07,01) && Date <= DateTime(2026,09,30)`,
      "Date ASC",
      2,
      undefined,
      100,
      undefined,
      { "x-test": "header" },
    );
  });

  it("returns a validation error without calling Xero", async () => {
    const { listXeroBankTransactions } = await import(
      "./list-xero-bank-transactions.handler.js"
    );

    const result = await listXeroBankTransactions(1, undefined, {
      fromDate: "2026-09-30",
      toDate: "2026-07-01",
    });

    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/after toDate/);
    expect(authenticateMock).not.toHaveBeenCalled();
    expect(getBankTransactionsMock).not.toHaveBeenCalled();
  });
});

describe("getXeroBankTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a single transaction by ID", async () => {
    const txn = { bankTransactionID: TXN, lineItems: [] };
    getBankTransactionMock.mockResolvedValue({ body: { bankTransactions: [txn] } });

    const { getXeroBankTransaction } = await import(
      "./get-xero-bank-transaction.handler.js"
    );

    const result = await getXeroBankTransaction(TXN);

    expect(result.isError).toBe(false);
    expect(result.result).toBe(txn);
    expect(getBankTransactionMock).toHaveBeenCalledWith(
      "tenant-123",
      TXN,
      undefined,
      { "x-test": "header" },
    );
  });

  it("returns null when Xero returns nothing", async () => {
    getBankTransactionMock.mockResolvedValue({ body: { bankTransactions: [] } });

    const { getXeroBankTransaction } = await import(
      "./get-xero-bank-transaction.handler.js"
    );

    const result = await getXeroBankTransaction(TXN);

    expect(result.isError).toBe(false);
    expect(result.result).toBeNull();
  });

  it("rejects a non-GUID ID without calling Xero", async () => {
    const { getXeroBankTransaction } = await import(
      "./get-xero-bank-transaction.handler.js"
    );

    const result = await getXeroBankTransaction("not-a-guid");

    expect(result.isError).toBe(true);
    expect(result.error).toMatch(/Invalid bankTransactionId/);
    expect(getBankTransactionMock).not.toHaveBeenCalled();
  });
});
