import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getInvoices: vi.fn(),
  getCreditNotes: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getInvoices: mocks.getInvoices,
      getCreditNotes: mocks.getCreditNotes,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: { "x-client": "test" } }),
}));

import { listXeroCreditNotes } from "../list-xero-credit-notes.handler.js";
import { listXeroInvoices } from "../list-xero-invoices.handler.js";

describe("document list date filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue(undefined);
    mocks.getInvoices.mockResolvedValue({ body: { invoices: [] } });
    mocks.getCreditNotes.mockResolvedValue({ body: { creditNotes: [] } });
  });

  it("passes an inclusive date range to getInvoices", async () => {
    await listXeroInvoices(
      2,
      undefined,
      undefined,
      "2025-10-01",
      "2026-05-01",
    );

    expect(mocks.getInvoices.mock.calls[0][2]).toBe(
      "Date >= DateTime(2025, 10, 01) && Date <= DateTime(2026, 05, 01)",
    );
    expect(mocks.getInvoices.mock.calls[0][8]).toBe(2);
  });

  it("combines contact and date filters for credit notes", async () => {
    await listXeroCreditNotes(
      3,
      "contact-id",
      "2026-01-01",
      "2026-01-31",
    );

    expect(mocks.getCreditNotes.mock.calls[0][2]).toBe(
      'Contact.ContactID=guid("contact-id") && Date >= DateTime(2026, 01, 01) && Date <= DateTime(2026, 01, 31)',
    );
    expect(mocks.getCreditNotes.mock.calls[0][4]).toBe(3);
  });
});
