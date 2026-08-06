import { describe, expect, it } from "vitest";
import { CreditNote } from "xero-node";
import {
  contactDeepLink,
  creditNoteDeepLink,
  invoiceDeepLink,
} from "../deeplinks.js";

describe("deep links", () => {
  it("uses AccountsReceivable for customer credit notes by default", () => {
    expect(creditNoteDeepLink("org", "credit-note")).toBe(
      "https://go.xero.com/organisationlogin/default.aspx?shortcode=org&redirecturl=/AccountsReceivable/ViewCreditNote.aspx?creditNoteID=credit-note",
    );
  });

  it("uses AccountsPayable for supplier credit notes", () => {
    expect(
      creditNoteDeepLink(
        "org",
        "credit-note",
        CreditNote.TypeEnum.ACCPAYCREDIT,
      ),
    ).toBe(
      "https://go.xero.com/organisationlogin/default.aspx?shortcode=org&redirecturl=/AccountsPayable/ViewCreditNote.aspx?creditNoteID=credit-note",
    );
  });

  it("does not prefix invoice or contact URLs with whitespace", () => {
    expect(invoiceDeepLink("org", "invoice")).toMatch(/^https:\/\//);
    expect(contactDeepLink("org", "contact")).toMatch(/^https:\/\//);
  });
});
