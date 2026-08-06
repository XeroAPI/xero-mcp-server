import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditNote } from "xero-node";

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

    const result = await updateXeroCreditNote("credit-note-id", undefined, "SUP-001");

    expect(result.isError).toBe(false);
    const creditNote = mocks.updateCreditNote.mock.calls[0][2].creditNotes[0];
    expect(creditNote).toMatchObject({ creditNoteNumber: "SUP-001" });
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
});
