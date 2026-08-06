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
      4,
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

  it("preserves a customer credit note number separately from its reference", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    const result = await createXeroCreditNote(
      "contact-id",
      undefined,
      CreditNote.TypeEnum.ACCRECCREDIT,
      "customer-reference",
      CreditNote.StatusEnum.DRAFT,
      undefined,
      undefined,
      undefined,
      "CM-2026-001",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createCreditNotes.mock.calls[0][1].creditNotes[0]).toMatchObject({
      reference: "customer-reference",
      creditNoteNumber: "CM-2026-001",
    });
  });

  it("rejects a customer credit note number on supplier credit notes", async () => {
    const result = await createXeroCreditNote(
      "contact-id",
      undefined,
      CreditNote.TypeEnum.ACCPAYCREDIT,
      undefined,
      CreditNote.StatusEnum.DRAFT,
      undefined,
      undefined,
      undefined,
      "CM-2026-001",
    );

    expect(result).toMatchObject({
      isError: true,
      error: "creditNoteNumber is only supported on ACCRECCREDIT customer credit notes. Use reference for supplier credit notes.",
    });
    expect(mocks.createCreditNotes).not.toHaveBeenCalled();
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
      4,
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

  it("requests four decimal places for credit note line prices", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ creditNoteID: "credit-note-id" }] },
    });

    const result = await createXeroCreditNote("contact-id", [{
      description: "Returned goods",
      unitAmount: 10.1234,
    }]);

    expect(result.isError).toBe(false);
    expect(mocks.createCreditNotes.mock.calls[0][3]).toBe(4);
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

  it("reports Xero validation errors instead of claiming creation succeeded", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: {
        creditNotes: [{
          validationErrors: [{ message: "A credit note reference is required." }],
        }],
      },
    });

    const result = await createXeroCreditNote("contact-id");

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "A credit note reference is required.",
    });
  });

  it("reports a generic error for message-less Xero validation failures", async () => {
    mocks.createCreditNotes.mockResolvedValue({
      body: { creditNotes: [{ validationErrors: [{}] }] },
    });

    const result = await createXeroCreditNote("contact-id");

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Xero returned a validation error.",
    });
  });
});
