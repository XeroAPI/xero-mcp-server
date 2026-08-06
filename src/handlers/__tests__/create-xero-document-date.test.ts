import { beforeEach, describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createInvoices: vi.fn(),
  createCreditNotes: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createInvoices: mocks.createInvoices,
      createCreditNotes: mocks.createCreditNotes,
    },
  },
}));

import { createXeroInvoice } from "../create-xero-invoice.handler.js";
import { createXeroCreditNote } from "../create-xero-credit-note.handler.js";

const lineItems = [{
  description: "Consulting",
  quantity: 1,
  unitAmount: 100,
  accountCode: "200",
  taxType: "OUTPUT2",
}];

describe("Xero document dates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createInvoices.mockResolvedValue({body: {invoices: [{invoiceID: "invoice-id"}]}});
    mocks.createCreditNotes.mockResolvedValue({body: {creditNotes: [{creditNoteID: "credit-note-id"}]}});
  });

  it("lets Xero assign the organisation-local invoice date when no date is provided", async () => {
    await createXeroInvoice("contact-id", lineItems, Invoice.TypeEnum.ACCREC);

    const invoice = mocks.createInvoices.mock.calls[0]?.[1]?.invoices?.[0];
    expect(invoice).not.toHaveProperty("date");
  });

  it("preserves an explicitly supplied invoice date", async () => {
    await createXeroInvoice(
      "contact-id",
      lineItems,
      Invoice.TypeEnum.ACCREC,
      undefined,
      "2026-08-07",
    );

    const invoice = mocks.createInvoices.mock.calls[0]?.[1]?.invoices?.[0];
    expect(invoice).toHaveProperty("date", "2026-08-07");
  });

  it("lets Xero assign the organisation-local credit-note date", async () => {
    await createXeroCreditNote("contact-id", lineItems);

    const creditNote = mocks.createCreditNotes.mock.calls[0]?.[1]?.creditNotes?.[0];
    expect(creditNote).not.toHaveProperty("date");
  });
});
