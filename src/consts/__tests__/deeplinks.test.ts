import { describe, expect, it } from "vitest";
import { creditNoteDeepLink } from "../deeplinks.js";

describe("creditNoteDeepLink", () => {
  it("opens the credit note through the accounts receivable route", () => {
    expect(creditNoteDeepLink("demo-org", "credit-note-id")).toBe(
      "https://go.xero.com/organisationlogin/default.aspx?shortcode=demo-org&redirecturl=/AccountsReceivable/ViewCreditNote.aspx?creditNoteID=credit-note-id",
    );
  });
});
