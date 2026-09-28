import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroJournals } from "./list-xero-journals.handler.js";

const journals = [
  {
    journalID: "j-1",
    journalNumber: 101,
    journalDate: "2026-08-01",
    sourceType: "ACCREC",
  },
];

describe("listXeroJournals", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("lists general ledger journals with no filters", async () => {
    mockAccountingApi.getJournals.mockResolvedValue({
      body: { journals },
    });

    const result = await listXeroJournals();

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(journals);
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockAccountingApi.getJournals).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      undefined,
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("forwards offset, paymentsOnly, and ifModifiedSince", async () => {
    mockAccountingApi.getJournals.mockResolvedValue({
      body: { journals },
    });

    await listXeroJournals({
      offset: 100,
      paymentsOnly: true,
      ifModifiedSince: "2026-07-01T00:00:00.000Z",
    });

    const [, ifModifiedSince, offset, paymentsOnly] =
      mockAccountingApi.getJournals.mock.calls[0];
    expect(ifModifiedSince).toBeInstanceOf(Date);
    expect((ifModifiedSince as Date).toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
    expect(offset).toBe(100);
    expect(paymentsOnly).toBe(true);
  });

  it("returns an error for an invalid ifModifiedSince value", async () => {
    const result = await listXeroJournals({
      ifModifiedSince: "not-a-date",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "ifModifiedSince must be a valid date.",
    });
    expect(mockAccountingApi.getJournals).not.toHaveBeenCalled();
  });

  it("returns an empty list when Xero omits journals", async () => {
    mockAccountingApi.getJournals.mockResolvedValue({ body: {} });

    const result = await listXeroJournals();

    expect(result).toEqual({
      result: [],
      isError: false,
      error: null,
    });
  });

  it("returns a formatted error when the list call fails", async () => {
    mockAccountingApi.getJournals.mockRejectedValue(
      new Error("insufficient_scope"),
    );

    const result = await listXeroJournals();

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "insufficient_scope",
    });
  });
});
