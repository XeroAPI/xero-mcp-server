import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroInvoices: vi.fn(),
  listXeroCreditNotes: vi.fn(),
}));

vi.mock("../../../handlers/list-xero-invoices.handler.js", () => ({
  listXeroInvoices: mocks.listXeroInvoices,
}));

vi.mock("../../../handlers/list-xero-credit-notes.handler.js", () => ({
  listXeroCreditNotes: mocks.listXeroCreditNotes,
}));

import ListCreditNotesTool from "../list-credit-notes.tool.js";
import ListInvoicesTool from "../list-invoices.tool.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
}>;

describe("document list line items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invoice line items on an unfiltered bulk page when requested", async () => {
    mocks.listXeroInvoices.mockResolvedValue({
      result: [
        {
          invoiceID: "invoice-id",
          invoiceNumber: "INV-1",
          total: 25,
          lineItems: [{ description: "Bulk invoice item", lineAmount: 25 }],
        },
      ],
      error: null,
    });

    const handler = ListInvoicesTool().handler as ToolHandler;
    const result = await handler({
      page: 1,
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      includeLineItems: true,
    });

    expect(mocks.listXeroInvoices).toHaveBeenCalledWith(
      1,
      undefined,
      undefined,
      "2026-01-01",
      "2026-01-31",
    );
    expect(result.content.map((item) => item.text).join("\n")).toContain(
      "Description: Bulk invoice item",
    );
  });

  it("returns credit-note line items when requested", async () => {
    mocks.listXeroCreditNotes.mockResolvedValue({
      result: [
        {
          creditNoteID: "credit-note-id",
          creditNoteNumber: "CN-1",
          total: 10,
          lineItems: [{ description: "Credit item", lineAmount: 10 }],
        },
      ],
      error: null,
    });

    const handler = ListCreditNotesTool().handler as ToolHandler;
    const result = await handler({
      page: 1,
      includeLineItems: true,
    });

    expect(result.content.map((item) => item.text).join("\n")).toContain(
      "Description: Credit item",
    );
  });
});
