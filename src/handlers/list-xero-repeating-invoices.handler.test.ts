import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import {
  buildRepeatingInvoiceWhere,
  listXeroRepeatingInvoices,
} from "./list-xero-repeating-invoices.handler.js";

const repeatingInvoices = Array.from({ length: 12 }, (_, index) => ({
  repeatingInvoiceID: `ri-${index + 1}`,
  status: "AUTHORISED",
  total: 100 + index,
}));

describe("buildRepeatingInvoiceWhere", () => {
  it("returns undefined when no filters are provided", () => {
    expect(buildRepeatingInvoiceWhere({})).toBeUndefined();
  });

  it("combines contact, status, and type filters", () => {
    expect(
      buildRepeatingInvoiceWhere({
        contactId: "430fa14a-f945-44d3-9f97-5df5e28441b8",
        status: "DRAFT",
        type: "ACCREC",
      }),
    ).toBe(
      'Contact.ContactID=guid("430fa14a-f945-44d3-9f97-5df5e28441b8") AND Status=="DRAFT" AND Type=="ACCREC"',
    );
  });

  it("rejects a non-GUID contactId", () => {
    expect(() =>
      buildRepeatingInvoiceWhere({ contactId: 'x") OR Status=="DRAFT' }),
    ).toThrow("contactId must be a Xero GUID.");
  });
});

describe("listXeroRepeatingInvoices", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("lists the first page of repeating invoices by default", async () => {
    mockAccountingApi.getRepeatingInvoices.mockResolvedValue({
      body: { repeatingInvoices },
    });

    const result = await listXeroRepeatingInvoices();

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toHaveLength(10);
    expect(result.result[0].repeatingInvoiceID).toBe("ri-1");
    expect(result.result[9].repeatingInvoiceID).toBe("ri-10");
    expect(mockAccountingApi.getRepeatingInvoices).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("returns the second page from the locally sliced result set", async () => {
    mockAccountingApi.getRepeatingInvoices.mockResolvedValue({
      body: { repeatingInvoices },
    });

    const result = await listXeroRepeatingInvoices({ page: 2 });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toHaveLength(2);
    expect(result.result.map((item) => item.repeatingInvoiceID)).toEqual([
      "ri-11",
      "ri-12",
    ]);
  });

  it("forwards status, type, and contact filters", async () => {
    mockAccountingApi.getRepeatingInvoices.mockResolvedValue({
      body: { repeatingInvoices: [] },
    });

    await listXeroRepeatingInvoices({
      page: 1,
      contactId: "430fa14a-f945-44d3-9f97-5df5e28441b8",
      status: "DRAFT",
      type: "ACCPAY",
    });

    expect(mockAccountingApi.getRepeatingInvoices).toHaveBeenCalledWith(
      "tenant-1",
      'Contact.ContactID=guid("430fa14a-f945-44d3-9f97-5df5e28441b8") AND Status=="DRAFT" AND Type=="ACCPAY"',
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("returns an empty list when Xero omits repeatingInvoices", async () => {
    mockAccountingApi.getRepeatingInvoices.mockResolvedValue({ body: {} });

    const result = await listXeroRepeatingInvoices({ page: 1 });

    expect(result).toEqual({
      result: [],
      isError: false,
      error: null,
    });
  });

  it("returns a formatted error when the list call fails", async () => {
    mockAccountingApi.getRepeatingInvoices.mockRejectedValue(
      new Error("rate limited"),
    );

    const result = await listXeroRepeatingInvoices({ page: 1 });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "rate limited",
    });
  });
});
