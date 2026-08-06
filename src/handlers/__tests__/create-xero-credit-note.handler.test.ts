import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditNote } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createCreditNotes: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createCreditNotes: mocks.createCreditNotes,
    },
  },
}));

import { createXeroCreditNote } from "../create-xero-credit-note.handler.js";

describe("createXeroCreditNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an empty draft supplier credit note with its supplier reference", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    const result = await createXeroCreditNote(
      "contact-id",
      undefined,
      CreditNote.TypeEnum.ACCPAYCREDIT,
      "supplier-reference",
    );

    expect(result).toMatchObject({ isError: false, error: null });
    expect(mocks.createCreditNotes).toHaveBeenCalledWith(
      "tenant-id",
      {
        creditNotes: [expect.objectContaining({
          type: CreditNote.TypeEnum.ACCPAYCREDIT,
          contact: { contactID: "contact-id" },
          creditNoteNumber: "supplier-reference",
        })],
      },
      true,
      undefined,
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("leaves omitted dates to Xero's organisation-timezone defaults", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    const result = await createXeroCreditNote("contact-id");

    expect(result.isError).toBe(false);
    const creditNote = mocks.createCreditNotes.mock.calls[0][1].creditNotes[0];
    expect(creditNote).not.toHaveProperty("date");
    expect(creditNote).not.toHaveProperty("dueDate");
  });

  it("sends explicitly supplied issue and due dates", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    const result = await createXeroCreditNote(
      "contact-id",
      [{ description: "Returned goods" }],
      CreditNote.TypeEnum.ACCRECCREDIT,
      undefined,
      CreditNote.StatusEnum.DRAFT,
      undefined,
      "2026-07-31",
      "2026-08-30",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createCreditNotes.mock.calls[0][1].creditNotes[0]).toMatchObject({
      date: "2026-07-31",
      dueDate: "2026-08-30",
    });
  });

  it("creates an approved credit note when requested", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    await createXeroCreditNote(
      "contact-id",
      [{ description: "Returned goods" }],
      CreditNote.TypeEnum.ACCPAYCREDIT,
      undefined,
      CreditNote.StatusEnum.AUTHORISED,
    );

    expect(mocks.createCreditNotes).toHaveBeenCalledWith(
      "tenant-id",
      {
        creditNotes: [expect.objectContaining({
          status: CreditNote.StatusEnum.AUTHORISED,
        })],
      },
      true,
      undefined,
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("forwards an idempotency key for safe retries", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    await createXeroCreditNote(
      "contact-id",
      undefined,
      CreditNote.TypeEnum.ACCRECCREDIT,
      undefined,
      CreditNote.StatusEnum.DRAFT,
      "credit-note-retry-key",
    );

    expect(mocks.createCreditNotes.mock.calls[0][4]).toBe("credit-note-retry-key");
  });

  it("rejects an authorised credit note with no lines before calling Xero", async () => {
    const result = await createXeroCreditNote(
      "contact-id",
      undefined,
      CreditNote.TypeEnum.ACCRECCREDIT,
      undefined,
      CreditNote.StatusEnum.AUTHORISED,
    );

    expect(result).toMatchObject({
      isError: true,
      error: "An authorised credit note requires at least one line item.",
    });
    expect(mocks.createCreditNotes).not.toHaveBeenCalled();
  });
});
