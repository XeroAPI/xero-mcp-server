import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroAgedPayablesByContact: vi.fn(),
}));

vi.mock("../../handlers/list-aged-payables-by-contact.handler.js", () => ({
  listXeroAgedPayablesByContact: mocks.listXeroAgedPayablesByContact,
}));

import ListAgedPayablesByContact from "./list-aged-payables-by-contact.tool.js";

describe("list-aged-payables-by-contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listXeroAgedPayablesByContact.mockResolvedValue({
      result: { reportName: "Aged Payables", reportDate: "2026-01-31", rows: [] },
      isError: false,
      error: null,
    });
  });

  it("labels date-filtered payables as bills", async () => {
    const result = await ListAgedPayablesByContact().handler({
      contactId: "contact-id",
      invoicesFromDate: "2026-01-01",
    }, {} as never);

    expect(mocks.listXeroAgedPayablesByContact).toHaveBeenCalledWith(
      "contact-id",
      undefined,
      "2026-01-01",
      undefined,
    );
    expect(result.content).toContainEqual({
      type: "text",
      text: "Showing bills from 2026-01-01",
    });
  });
});
