import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
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
  });

  it("forwards supplier credit note types", async () => {
    mocks.createXeroCreditNote.mockResolvedValue({
      result: {
        creditNoteID: "credit-note-id",
        type: CreditNote.TypeEnum.ACCPAYCREDIT,
        contact: { name: "Example supplier" },
      },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await tool.handler({
      contactId: "contact-id",
      type: "ACCPAYCREDIT",
    }, {} as never);

    expect(mocks.createXeroCreditNote).toHaveBeenCalledWith(
      "contact-id",
      undefined,
      CreditNote.TypeEnum.ACCPAYCREDIT,
      undefined,
    );
  });
});
