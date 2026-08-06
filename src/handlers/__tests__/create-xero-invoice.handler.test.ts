import { beforeEach, describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createInvoices: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createInvoices: mocks.createInvoices,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroInvoice } from "../create-xero-invoice.handler.js";

describe("createXeroInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createInvoices.mockResolvedValue({
      body: { invoices: [{ invoiceID: "invoice-id" }] },
    });
  });

  it("forwards an idempotency key for safe retries", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [{ description: "Consulting services" }],
      Invoice.TypeEnum.ACCREC,
      undefined,
      undefined,
      "invoice-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createInvoices.mock.calls[0][4]).toBe("invoice-retry-key");
  });

  it("leaves dates, payment terms, and status to Xero when they are not supplied", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [{ description: "Consulting services" }],
    );

    expect(result.isError).toBe(false);
    const invoice = mocks.createInvoices.mock.calls[0][1].invoices[0];
    expect(invoice).not.toHaveProperty("date");
    expect(invoice).not.toHaveProperty("dueDate");
    expect(invoice).not.toHaveProperty("expectedPaymentDate");
    expect(invoice).not.toHaveProperty("plannedPaymentDate");
    expect(invoice).not.toHaveProperty("status");
  });

  it("sends a supplied due date and initial status", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [{ description: "Consulting services" }],
      Invoice.TypeEnum.ACCREC,
      undefined,
      "2026-08-01",
      undefined,
      "2026-08-31",
      Invoice.StatusEnum.AUTHORISED,
    );

    expect(result.isError).toBe(false);
    expect(mocks.createInvoices.mock.calls[0][1].invoices[0]).toMatchObject({
      date: "2026-08-01",
      dueDate: "2026-08-31",
      status: Invoice.StatusEnum.AUTHORISED,
    });
  });

  it("sends sales invoice discounts", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [{
        description: "Consulting services",
        discountRate: 10,
        discountAmount: 5,
      }],
    );

    expect(result.isError).toBe(false);
    expect(mocks.createInvoices.mock.calls[0][1].invoices[0].lineItems).toEqual([
      expect.objectContaining({ discountRate: 10, discountAmount: 5 }),
    ]);
  });

  it("sends the correct cash-forecast date for each invoice type", async () => {
    await createXeroInvoice(
      "contact-id",
      [{ description: "Consulting services" }],
      Invoice.TypeEnum.ACCREC,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "2026-09-15",
    );
    expect(mocks.createInvoices.mock.calls[0][1].invoices[0]).toMatchObject({
      expectedPaymentDate: "2026-09-15",
    });

    await createXeroInvoice(
      "contact-id",
      [{ description: "Office supplies" }],
      Invoice.TypeEnum.ACCPAY,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "2026-09-20",
    );
    expect(mocks.createInvoices.mock.calls[1][1].invoices[0]).toMatchObject({
      plannedPaymentDate: "2026-09-20",
    });
  });

  it("rejects cash-forecast dates for the wrong invoice type", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [{ description: "Office supplies" }],
      Invoice.TypeEnum.ACCPAY,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "2026-09-15",
    );

    expect(result).toMatchObject({
      isError: true,
      error: "Expected payment dates are only supported on ACCREC sales invoices.",
    });
    expect(mocks.createInvoices).not.toHaveBeenCalled();
  });

  it("rejects line discounts on ACCPAY bills", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [{ description: "Office supplies", discountRate: 10 }],
      Invoice.TypeEnum.ACCPAY,
    );

    expect(result).toMatchObject({
      isError: true,
      error: "Line discounts are only supported on ACCREC sales invoices.",
    });
    expect(mocks.createInvoices).not.toHaveBeenCalled();
  });
});
