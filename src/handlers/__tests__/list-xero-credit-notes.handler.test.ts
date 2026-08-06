import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getCreditNotes: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getCreditNotes: mocks.getCreditNotes,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { listXeroCreditNotes } from "../list-xero-credit-notes.handler.js";

describe("listXeroCreditNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCreditNotes.mockResolvedValue({ body: { creditNotes: [] } });
  });

  it("filters with a UUID contact ID", async () => {
    const result = await listXeroCreditNotes(
      1,
      "123e4567-e89b-12d3-a456-426614174000",
    );

    expect(result.isError).toBe(false);
    expect(mocks.getCreditNotes).toHaveBeenCalledWith(
      "tenant-id",
      undefined,
      'Contact.ContactID=guid("123e4567-e89b-12d3-a456-426614174000")',
      "UpdatedDateUTC DESC",
      1,
      undefined,
      10,
      { headers: {} },
    );
  });

  it("rejects a malformed contact ID before constructing the query", async () => {
    const result = await listXeroCreditNotes(
      1,
      'contact-id") OR Status=="AUTHORISED',
    );

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Contact ID must be a valid UUID.",
    });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.getCreditNotes).not.toHaveBeenCalled();
  });
});
