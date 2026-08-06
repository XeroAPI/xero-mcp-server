import { z } from "zod";
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
      date: "2026-07-31",
      dueDate: "2026-08-30",
    }, {} as never);

    expect(mocks.updateXeroCreditNote).toHaveBeenCalledWith(
      "credit-note-id",
      undefined,
      "SUP-001",
      undefined,
      "2026-07-31",
      "2026-08-30",
      undefined,
    );
  });

  it("maps existing line identities and preserves item tracking", async () => {
    vi.clearAllMocks();
    mocks.updateXeroCreditNote.mockResolvedValue({
      result: { creditNoteID: "credit-note-id" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await UpdateCreditNoteTool().handler({
      creditNoteId: "credit-note-id",
      lineItems: [{
        lineItemId: "line-item-id",
        description: "Returned goods",
        quantity: 1,
        unitAmount: 100,
        itemCode: "RETURN",
        accountCode: "200",
        taxType: "OUTPUT",
        tracking: [{ trackingOptionID: "option-id" }],
      }],
    }, {} as never);

    expect(mocks.updateXeroCreditNote).toHaveBeenCalledWith(
      "credit-note-id",
      [expect.objectContaining({
        lineItemID: "line-item-id",
        itemCode: "RETURN",
        tracking: [{ trackingOptionID: "option-id" }],
      })],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(mocks.updateXeroCreditNote.mock.calls[0][1][0]).not.toHaveProperty("lineItemId");
  });

  it("validates tracking allocations", () => {
    const schema = z.object(UpdateCreditNoteTool().schema as z.ZodRawShape);
    const base = {
      creditNoteId: "credit-note-id",
      lineItems: [{
        description: "Returned goods",
        quantity: 1,
        unitAmount: 100,
        accountCode: "200",
        taxType: "OUTPUT",
      }],
    };

    expect(schema.safeParse({
      ...base,
      lineItems: [{ ...base.lineItems[0], tracking: [{ trackingOptionID: "option-id" }] }],
    }).success).toBe(true);
    expect(schema.safeParse({
      ...base,
      lineItems: [{ ...base.lineItems[0], tracking: [{}] }],
    }).success).toBe(false);
  });

  it("forwards an idempotency key for safe retries", async () => {
    vi.clearAllMocks();
    mocks.updateXeroCreditNote.mockResolvedValue({
      result: { creditNoteID: "credit-note-id" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await UpdateCreditNoteTool().handler({
      creditNoteId: "credit-note-id",
      reference: "CUST-001",
      idempotencyKey: "credit-note-update-retry-key",
    }, {} as never);

    expect(mocks.updateXeroCreditNote.mock.calls[0][6]).toBe(
      "credit-note-update-retry-key",
    );
  });

  it("limits idempotency keys to Xero's supported length", () => {
    const schema = z.object(UpdateCreditNoteTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      creditNoteId: "credit-note-id",
      idempotencyKey: "x".repeat(128),
    }).success).toBe(true);
    expect(schema.safeParse({
      creditNoteId: "credit-note-id",
      idempotencyKey: "x".repeat(129),
    }).success).toBe(false);
  });
});
