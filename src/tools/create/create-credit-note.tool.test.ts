import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditNote } from "xero-node";

const mocks = vi.hoisted(() => ({
  createXeroCreditNote: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-credit-note.handler.js", () => ({
  createXeroCreditNote: mocks.createXeroCreditNote,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    CREDIT_NOTE: "CREDIT_NOTE",
  },
  getDeepLink: mocks.getDeepLink,
}));

import CreateCreditNoteTool from "./create-credit-note.tool.js";

describe("create-credit-note tool", () => {
  const tool = CreateCreditNoteTool();
  const schema = z.object(tool.schema as z.ZodRawShape);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts Xero's minimum draft credit note", () => {
    expect(schema.safeParse({ contactId: "contact-id" }).success).toBe(true);
    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{ description: "Returned goods" }],
    }).success).toBe(true);
    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{}],
    }).success).toBe(false);
    expect(schema.safeParse({
      contactId: "contact-id",
      status: "SUBMITTED",
    }).success).toBe(false);
    expect(schema.safeParse({
      contactId: "contact-id",
      idempotencyKey: "x".repeat(129),
    }).success).toBe(false);
  });

  it("forwards supplier credit note types and statuses", async () => {
    mocks.createXeroCreditNote.mockResolvedValue({
      result: {
        creditNoteID: "credit-note-id",
        type: CreditNote.TypeEnum.ACCPAYCREDIT,
        contact: { name: "Example supplier" },
        date: "2026-07-31",
        dueDate: "2026-08-30",
      },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    const result = await tool.handler({
      contactId: "contact-id",
      lineItems: [{ description: "Returned goods" }],
      type: "ACCPAYCREDIT",
      date: "2026-07-31",
      dueDate: "2026-08-30",
      status: "AUTHORISED",
      idempotencyKey: "credit-note-retry-key",
    }, {} as never);

    expect(mocks.createXeroCreditNote).toHaveBeenCalledWith(
      "contact-id",
      [{ description: "Returned goods" }],
      CreditNote.TypeEnum.ACCPAYCREDIT,
      undefined,
      CreditNote.StatusEnum.AUTHORISED,
      "credit-note-retry-key",
      "2026-07-31",
      "2026-08-30",
    );
    const text = result.content.find((content) => content.type === "text")?.text;
    expect(text).toContain("Due Date: 2026-08-30");
  });

  it("rejects an empty authorised credit note before calling the handler", async () => {
    const result = await tool.handler({
      contactId: "contact-id",
      status: "AUTHORISED",
    }, {} as never);
    const text = result.content.find((content) => content.type === "text")?.text;

    expect(mocks.createXeroCreditNote).not.toHaveBeenCalled();
    expect(text).toBe(
      "Error creating credit note: An authorised credit note requires at least one line item.",
    );
  });
});
