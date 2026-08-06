import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../handlers/list-xero-invoices.handler.js", () => ({
  listXeroInvoices: vi.fn(),
}));

import { listXeroInvoices } from "../../handlers/list-xero-invoices.handler.js";
import ListInvoicesTool from "./list-invoices.tool.js";

const listInvoices = vi.mocked(listXeroInvoices);

describe("list-invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders invoice cash-forecast dates", async () => {
    listInvoices.mockResolvedValue({
      result: [{
        invoiceID: "invoice-id",
        invoiceNumber: "INV-001",
        expectedPaymentDate: "2026-09-15",
        plannedPaymentDate: "2026-09-20",
      }],
      isError: false,
      error: null,
    } as never);

    const response = await ListInvoicesTool().handler(
      { page: 1 },
      {} as never,
    );
    const content = response.content as Array<{ text: string }>;

    expect(content[1].text).toContain("Expected Payment Date: 2026-09-15");
    expect(content[1].text).toContain("Planned Payment Date: 2026-09-20");
  });
});
