import { beforeEach, describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createPayment: vi.fn(),
  createInvoices: vi.fn(),
  createBankTransactions: vi.fn(),
  createCreditNotes: vi.fn(),
  createManualJournals: vi.fn(),
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

const { runWithIdempotencyKey } = await import("../../helpers/idempotency-key.js");
const { createXeroPayment } = await import("../create-xero-payment.handler.js");
const { createXeroInvoice } = await import("../create-xero-invoice.handler.js");
const { createXeroBankTransaction } =
  await import("../create-xero-bank-transaction.handler.js");
const { createXeroCreditNote } =
  await import("../create-xero-credit-note.handler.js");
const { createXeroManualJournal } =
  await import("../create-xero-manual-journal.handler.js");

const idempotencyKey = "caller-retry-key";

const lineItems = [
  {
    description: "Consulting",
    quantity: 1,
    unitAmount: 42,
    accountCode: "200",
    taxType: "NONE",
  },
];

// The idempotency key reaches Xero as a request header, not as the SDK's
// positional idempotencyKey argument: the SDK assigns options.headers over the
// header it derives from that argument, so options.headers is what ships.
function lastCallHeaders(mock: { mock: { calls: unknown[][] } }) {
  const call = mock.mock.calls.at(-1);
  return (call?.at(-1) as { headers: Record<string, string> }).headers;
}

const creates: Array<{
  name: string;
  mock: (typeof mocks)[keyof typeof mocks];
  body: unknown;
  run: () => Promise<{ isError: boolean }>;
}> = [
  {
    name: "payment",
    mock: mocks.createPayment,
    body: { payments: [{ paymentID: "payment-id" }] },
    run: () =>
      createXeroPayment({
        invoiceId: "invoice-id",
        accountId: "account-id",
        amount: 42,
      }),
  },
  {
    name: "invoice",
    mock: mocks.createInvoices,
    body: { invoices: [{ invoiceID: "invoice-id" }] },
    run: () =>
      createXeroInvoice(
        "contact-id",
        lineItems,
        Invoice.TypeEnum.ACCREC,
        "reference",
        "2026-08-07",
      ),
  },
  {
    name: "bank transaction",
    mock: mocks.createBankTransactions,
    body: { bankTransactions: [{ bankTransactionID: "bank-transaction-id" }] },
    run: () =>
      createXeroBankTransaction(
        "RECEIVE",
        "bank-account-id",
        "contact-id",
        lineItems,
        "reference",
        "2026-08-07",
      ),
  },
  {
    name: "credit note",
    mock: mocks.createCreditNotes,
    body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    run: () => createXeroCreditNote("contact-id", lineItems, "reference"),
  },
  {
    name: "manual journal",
    mock: mocks.createManualJournals,
    body: { manualJournals: [{ manualJournalID: "manual-journal-id" }] },
    run: () =>
      createXeroManualJournal("Opening balance", [
        { lineAmount: 42, accountCode: "200" },
      ]),
  },
];

describe("financial create handler idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(creates)(
    "sends the ambient key as an Idempotency-Key header when creating a $name",
    async ({ mock, body, run }) => {
      mock.mockResolvedValue({ body });

      const result = await runWithIdempotencyKey(idempotencyKey, run);

      expect(result.isError).toBe(false);
      expect(lastCallHeaders(mock)).toMatchObject({
        "Idempotency-Key": idempotencyKey,
      });
    },
  );

  it.each(creates)(
    "omits the Idempotency-Key header for an unkeyed $name create",
    async ({ mock, body, run }) => {
      mock.mockResolvedValue({ body });

      const result = await run();

      expect(result.isError).toBe(false);
      expect(lastCallHeaders(mock)).not.toHaveProperty("Idempotency-Key");
    },
  );
});
