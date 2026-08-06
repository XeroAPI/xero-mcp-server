import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateXeroCreditNote: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/update-xero-credit-note.handler.js", () => ({
  updateXeroCreditNote: mocks.updateXeroCreditNote,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { CREDIT_NOTE: "CREDIT_NOTE" },
  getDeepLink: mocks.getDeepLink,
}));

import UpdateCreditNoteTool from "./update-credit-note.tool.js";

describe("update-credit-note tool", () => {
  it("forwards the generic reference input unchanged", async () => {
    mocks.updateXeroCreditNote.mockResolvedValue({
      result: { creditNoteID: "credit-note-id" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await UpdateCreditNoteTool().handler({
      creditNoteId: "credit-note-id",
      reference: "SUP-001",
    }, {} as never);

    expect(mocks.updateXeroCreditNote).toHaveBeenCalledWith(
      "credit-note-id",
      undefined,
      "SUP-001",
      undefined,
      undefined,
    );
  });
});
