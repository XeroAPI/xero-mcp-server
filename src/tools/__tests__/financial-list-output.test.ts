import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listInvoices: vi.fn(),
  listCreditNotes: vi.fn(),
  listQuotes: vi.fn(),
  listBankTransactions: vi.fn(),
}));

vi.mock("../../handlers/list-xero-invoices.handler.js", () => ({
  listXeroInvoices: mocks.listInvoices,
}));

vi.mock("../../handlers/list-xero-credit-notes.handler.js", () => ({
  listXeroCreditNotes: mocks.listCreditNotes,
}));

vi.mock("../../handlers/list-xero-quotes.handler.js", () => ({
  listXeroQuotes: mocks.listQuotes,
}));

vi.mock("../../handlers/list-xero-bank-transactions.handler.js", () => ({
  listXeroBankTransactions: mocks.listBankTransactions,
}));

import ListBankTransactionsTool from "../list/list-bank-transactions.tool.js";
import ListCreditNotesTool from "../list/list-credit-notes.tool.js";
import ListInvoicesTool from "../list/list-invoices.tool.js";
import ListQuotesTool from "../list/list-quotes.tool.js";

const zeroValueText = [
  "Sub Total: 0",
  "Total Tax: 0",
  "Total: 0",
].join("\n");

describe("financial list tool output", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps zero invoice balances and separates requested line items", async () => {
    mocks.listInvoices.mockResolvedValue({
      error: null,
      result: [{
        invoiceID: "invoice-id",
        invoiceNumber: "INV-001",
        subTotal: 0,
        totalTax: 0,
        total: 0,
        totalDiscount: 0,
        currencyRate: 0,
        amountDue: 0,
        amountPaid: 0,
        amountCredited: 0,
        lineItems: [
          { description: "First line" },
          { description: "Second line" },
        ],
      }],
    });

    const result = await ListInvoicesTool().handler({
      page: 1,
      invoiceNumbers: ["INV-001"],
    }, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining(`${zeroValueText}\nTotal Discount: 0\nCurrency Rate: 0\nAmount Due: 0\nAmount Paid: 0\nAmount Credited: 0`),
    });
    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining("Description: First line\nQuantity: undefined\nUnit Amount: undefined\nAccount Code: undefined\nTax Type: undefined\nTracking: undefined\nLine Amount: undefined\n\nItem ID: undefined\nItem Code: undefined\nDescription: Second line"),
    });
  });

  it("keeps zero credit-note values", async () => {
    mocks.listCreditNotes.mockResolvedValue({
      error: null,
      result: [{
        creditNoteID: "credit-note-id",
        creditNoteNumber: "CN-001",
        subTotal: 0,
        totalTax: 0,
        total: 0,
        currencyRate: 0,
      }],
    });

    const result = await ListCreditNotesTool().handler({ page: 1 }, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining(`${zeroValueText}\nCurrency Rate: 0`),
    });
  });

  it("keeps zero quote values", async () => {
    mocks.listQuotes.mockResolvedValue({
      error: null,
      result: [{
        quoteID: "quote-id",
        quoteNumber: "QU-001",
        subTotal: 0,
        totalTax: 0,
        total: 0,
        totalDiscount: 0,
        currencyRate: 0,
      }],
    });

    const result = await ListQuotesTool().handler({ page: 1 }, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining(`${zeroValueText}\nTotal Discount: 0\nCurrency Rate: 0`),
    });
  });

  it("keeps zero bank-transaction values and does not render undefined line items", async () => {
    mocks.listBankTransactions.mockResolvedValue({
      isError: false,
      result: [{
        bankTransactionID: "bank-transaction-id",
        bankAccount: { name: "Operating", accountID: "account-id" },
        subTotal: 0,
        totalTax: 0,
        total: 0,
      }],
    });

    const result = await ListBankTransactionsTool().handler({ page: 1 }, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining(`${zeroValueText}\nUnknown\nLine Items: `),
    });
    expect(result.content[1]).not.toMatchObject({ text: expect.stringContaining("Line Items: undefined") });
  });
});
