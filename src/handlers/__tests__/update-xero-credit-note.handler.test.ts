import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditNote, LineAmountTypes } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getCreditNote: vi.fn(),
  updateCreditNote: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getCreditNote: mocks.getCreditNote,
      updateCreditNote: mocks.updateCreditNote,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { updateXeroCreditNote } from "../update-xero-credit-note.handler.js";

describe("updateXeroCreditNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateCreditNote.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });
  });

  it("maps a supplier credit reference to creditNoteNumber", async () => {
    mocks.getCreditNote.mockResolvedValue({
      body: {
        creditNotes: [{
          status: CreditNote.StatusEnum.DRAFT,
          type: CreditNote.TypeEnum.ACCPAYCREDIT,
        }],
      },
    });

    const result = await updateXeroCreditNote(
      "credit-note-id",
      undefined,
      "SUP-001",
      undefined,
      "2026-07-31",
      "2026-08-30",
    );

    expect(result.isError).toBe(false);
    const creditNote = mocks.updateCreditNote.mock.calls[0][2].creditNotes[0];
    expect(creditNote).toMatchObject({
      creditNoteNumber: "SUP-001",
      date: "2026-07-31",
      dueDate: "2026-08-30",
    });
    expect(creditNote).not.toHaveProperty("reference");
  });

  it("maps a customer credit reference to reference", async () => {
    mocks.getCreditNote.mockResolvedValue({
      body: {
        creditNotes: [{
          status: CreditNote.StatusEnum.DRAFT,
          type: CreditNote.TypeEnum.ACCRECCREDIT,
        }],
      },
    });

    const result = await updateXeroCreditNote("credit-note-id", undefined, "CUST-001");

    expect(result.isError).toBe(false);
    const creditNote = mocks.updateCreditNote.mock.calls[0][2].creditNotes[0];
    expect(creditNote).toMatchObject({ reference: "CUST-001" });
    expect(creditNote).not.toHaveProperty("creditNoteNumber");
  });

  it("preserves line identities, tracking, item codes, and tax basis", async () => {
    mocks.getCreditNote.mockResolvedValue({
      body: {
        creditNotes: [{
          status: CreditNote.StatusEnum.DRAFT,
          type: CreditNote.TypeEnum.ACCRECCREDIT,
          lineAmountTypes: LineAmountTypes.Inclusive,
        }],
      },
    });

    const result = await updateXeroCreditNote("credit-note-id", [{
      lineItemID: "line-item-id",
      description: "Returned goods",
      quantity: 1,
      unitAmount: 100,
      itemCode: "RETURN",
      accountCode: "200",
      taxType: "OUTPUT",
      tracking: [{
        trackingCategoryID: "category-id",
        trackingOptionID: "option-id",
      }],
    }]);

    expect(result.isError).toBe(false);
    const creditNote = mocks.updateCreditNote.mock.calls[0][2].creditNotes[0];
    expect(creditNote).toMatchObject({
      lineAmountTypes: LineAmountTypes.Inclusive,
      lineItems: [expect.objectContaining({
        lineItemID: "line-item-id",
        itemCode: "RETURN",
        tracking: [{
          trackingCategoryID: "category-id",
          trackingOptionID: "option-id",
        }],
      })],
    });
  });

  it("forwards an idempotency key for safe credit-note update retries", async () => {
    mocks.getCreditNote.mockResolvedValue({
      body: {
        creditNotes: [{
          status: CreditNote.StatusEnum.DRAFT,
          type: CreditNote.TypeEnum.ACCRECCREDIT,
        }],
      },
    });

    const result = await updateXeroCreditNote(
      "credit-note-id",
      undefined,
      "CUST-001",
      undefined,
      undefined,
      undefined,
      "credit-note-update-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateCreditNote.mock.calls[0][4]).toBe(
      "credit-note-update-retry-key",
    );
  });

  it("reports an error response returned with an HTTP-successful update", async () => {
    mocks.getCreditNote.mockResolvedValue({
      body: {
        creditNotes: [{
          status: CreditNote.StatusEnum.DRAFT,
          type: CreditNote.TypeEnum.ACCRECCREDIT,
        }],
      },
    });
    mocks.updateCreditNote.mockResolvedValue({
      body: { creditNotes: [{ hasErrors: true }] },
    });

    const result = await updateXeroCreditNote("credit-note-id");

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Xero returned a validation error.",
    });
  });
});
