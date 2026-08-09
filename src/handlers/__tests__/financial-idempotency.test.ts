import { beforeEach, describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createPayment: vi.fn(),
  createInvoices: vi.fn(),
  createBankTransactions: vi.fn(),
  createCreditNotes: vi.fn(),
  createManualJournals: vi.fn(),
  getClientHeaders: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createPayment: mocks.createPayment,
      createInvoices: mocks.createInvoices,
      createBankTransactions: mocks.createBankTransactions,
      createCreditNotes: mocks.createCreditNotes,
      createManualJournals: mocks.createManualJournals,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: mocks.getClientHeaders,
}));

const { createXeroPayment } = await import("../create-xero-payment.handler.js");
const { createXeroInvoice } = await import("../create-xero-invoice.handler.js");
const { createXeroBankTransaction } =
  await import("../create-xero-bank-transaction.handler.js");
const { createXeroCreditNote } =
  await import("../create-xero-credit-note.handler.js");
const { createXeroManualJournal } =
  await import("../create-xero-manual-journal.handler.js");

const headers = { headers: { "x-test-header": "test" } };
const idempotencyKey = "caller-retry-key";

describe("financial create handler idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientHeaders.mockReturnValue(headers);
  });

  it("forwards a payment key in Xero's idempotency parameter", async () => {
    mocks.createPayment.mockResolvedValue({
      body: { payments: [{ paymentID: "payment-id" }] },
    });

    const result = await createXeroPayment({
      invoiceId: "invoice-id",
      accountId: "account-id",
      amount: 42,
      idempotencyKey,
    });

    expect(result.isError).toBe(false);
    expect(mocks.createPayment).toHaveBeenCalledWith(
      "tenant-id",
      expect.objectContaining({
        invoice: { invoiceID: "invoice-id" },
        account: { accountID: "account-id" },
        amount: 42,
      }),
      idempotencyKey,
      headers,
    );
  });

  it("forwards an invoice key in Xero's idempotency parameter", async () => {
    mocks.createInvoices.mockResolvedValue({
      body: { invoices: [{ invoiceID: "invoice-id" }] },
    });

    const result = await createXeroInvoice(
      "contact-id",
      [
        {
          description: "Consulting",
          quantity: 1,
          unitAmount: 42,
          accountCode: "200",
          taxType: "NONE",
        },
      ],
      Invoice.TypeEnum.ACCREC,
      "reference",
      "2026-08-07",
      idempotencyKey,
    );

    expect(result.isError).toBe(false);
    expect(mocks.createInvoices).toHaveBeenCalledWith(
      "tenant-id",
      expect.objectContaining({ invoices: [expect.any(Object)] }),
      true,
      undefined,
      idempotencyKey,
      headers,
    );
  });

  it("forwards a bank transaction key in Xero's idempotency parameter", async () => {
    mocks.createBankTransactions.mockResolvedValue({
      body: {
        bankTransactions: [{ bankTransactionID: "bank-transaction-id" }],
      },
    });

    const result = await createXeroBankTransaction(
      "RECEIVE",
      "bank-account-id",
      "contact-id",
      [
        {
          description: "Deposit",
          quantity: 1,
          unitAmount: 42,
          accountCode: "200",
          taxType: "NONE",
        },
      ],
      "reference",
      "2026-08-07",
      idempotencyKey,
    );

    expect(result.isError).toBe(false);
    expect(mocks.createBankTransactions).toHaveBeenCalledWith(
      "tenant-id",
      expect.objectContaining({ bankTransactions: [expect.any(Object)] }),
      true,
      undefined,
      idempotencyKey,
      headers,
    );
  });

  it("forwards a credit note key in Xero's idempotency parameter", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    const result = await createXeroCreditNote(
      "contact-id",
      [
        {
          description: "Credit",
          quantity: 1,
          unitAmount: 42,
          accountCode: "200",
          taxType: "NONE",
        },
      ],
      "reference",
      idempotencyKey,
    );

    expect(result.isError).toBe(false);
    expect(mocks.createCreditNotes).toHaveBeenCalledWith(
      "tenant-id",
      expect.objectContaining({ creditNotes: [expect.any(Object)] }),
      true,
      undefined,
      idempotencyKey,
      headers,
    );
  });

  it("forwards a manual journal key in Xero's idempotency parameter", async () => {
    mocks.createManualJournals.mockResolvedValue({
      body: { manualJournals: [{ manualJournalID: "manual-journal-id" }] },
    });

    const result = await createXeroManualJournal(
      "Opening balance",
      [
        {
          lineAmount: 42,
          accountCode: "200",
        },
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      idempotencyKey,
    );

    expect(result.isError).toBe(false);
    expect(mocks.createManualJournals).toHaveBeenCalledWith(
      "tenant-id",
      expect.objectContaining({ manualJournals: [expect.any(Object)] }),
      true,
      idempotencyKey,
      headers,
    );
  });
});
