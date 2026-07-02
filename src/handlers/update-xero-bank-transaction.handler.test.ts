import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankTransaction } from "xero-node";

const authenticateMock = vi.fn();
const getBankTransactionMock = vi.fn();
const updateBankTransactionMock = vi.fn();
const getClientHeadersMock = vi.fn(() => ({ "x-test": "header" }));

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-123",
    authenticate: authenticateMock,
    accountingApi: {
      getBankTransaction: getBankTransactionMock,
      updateBankTransaction: updateBankTransactionMock,
    },
  },
}));

vi.mock("../helpers/get-client-headers.js", () => ({
  getClientHeaders: getClientHeadersMock,
}));

describe("updateXeroBankTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a minimal update payload when line items are provided", async () => {
    const existingBankTransaction: Partial<BankTransaction> = {
      bankTransactionID: "btx-123",
      reference: "old-ref",
      date: "2026-06-01",
      lineItems: [
        {
          description: "Old item",
          quantity: 1,
          unitAmount: 10,
          accountCode: "200",
          taxType: "NONE",
        },
      ],
      status: BankTransaction.StatusEnum.AUTHORISED,
    };

    const newLineItems = [
      {
        description: "Updated item",
        quantity: 2,
        unitAmount: 25,
        accountCode: "310",
        taxType: "OUTPUT2",
      },
    ];

    getBankTransactionMock.mockResolvedValue({
      body: { bankTransactions: [existingBankTransaction] },
    });
    updateBankTransactionMock.mockResolvedValue({
      body: {
        bankTransactions: [
          {
            bankTransactionID: "btx-123",
            lineItems: newLineItems,
          },
        ],
      },
    });

    const { updateXeroBankTransaction } = await import(
      "./update-xero-bank-transaction.handler.js"
    );

    const result = await updateXeroBankTransaction(
      "btx-123",
      undefined,
      undefined,
      newLineItems,
      "new-ref",
      "2026-06-12",
    );

    expect(result.isError).toBe(false);
    expect(authenticateMock).toHaveBeenCalledTimes(1);
    expect(updateBankTransactionMock).toHaveBeenCalledWith(
      "tenant-123",
      "btx-123",
      {
        bankTransactions: [
          {
            lineItems: newLineItems,
            reference: "new-ref",
            date: "2026-06-12",
          },
        ],
      },
      undefined,
      undefined,
      { "x-test": "header" },
    );

    const payload = updateBankTransactionMock.mock.calls[0][2].bankTransactions[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("currencyCode");
    expect(payload).not.toHaveProperty("bankTransactionID");
  });
});
