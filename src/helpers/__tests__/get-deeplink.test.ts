import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditNote } from "xero-node";

const getShortCode = vi.fn();

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    getShortCode: () => getShortCode(),
  },
}));

const { DeepLinkType, getDeepLink } = await import("../get-deeplink.js");

describe("getDeepLink", () => {
  beforeEach(() => {
    getShortCode.mockReset();
    getShortCode.mockResolvedValue("org");
  });

  it("passes the credit note type through to the credit note deep link", async () => {
    await expect(
      getDeepLink(DeepLinkType.CREDIT_NOTE, "credit-note", {
        creditNoteType: CreditNote.TypeEnum.ACCPAYCREDIT,
      }),
    ).resolves.toBe(
      "https://go.xero.com/organisationlogin/default.aspx?shortcode=org&redirecturl=/AccountsPayable/ViewCreditNote.aspx?creditNoteID=credit-note",
    );
  });

  it("defaults to the receivable credit note area when no type is supplied", async () => {
    await expect(
      getDeepLink(DeepLinkType.CREDIT_NOTE, "credit-note"),
    ).resolves.toBe(
      "https://go.xero.com/organisationlogin/default.aspx?shortcode=org&redirecturl=/AccountsReceivable/ViewCreditNote.aspx?creditNoteID=credit-note",
    );
  });

  it("throws when the organisation short code cannot be retrieved", async () => {
    getShortCode.mockResolvedValue(undefined);

    await expect(
      getDeepLink(DeepLinkType.CREDIT_NOTE, "credit-note"),
    ).rejects.toThrow("Failed to retrieve organisation short code");
  });
});
