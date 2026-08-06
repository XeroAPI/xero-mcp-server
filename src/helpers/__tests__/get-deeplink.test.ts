import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getShortCode: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    getShortCode: mocks.getShortCode,
  },
}));

import { DeepLinkType, getDeepLink } from "../get-deeplink.js";

describe("getDeepLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getShortCode.mockResolvedValue("!short-code");
  });

  it("creates bank transaction links scoped to the organisation", async () => {
    await expect(
      getDeepLink(DeepLinkType.BANK_TRANSACTION, "transaction-id"),
    ).resolves.toBe(
      "https://go.xero.com/organisationlogin/default.aspx?shortcode=!short-code&redirecturl=/Bank/ViewTransaction.aspx?bankTransactionID=transaction-id",
    );

    expect(mocks.getShortCode).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "invoice",
      DeepLinkType.INVOICE,
      "invoice-id",
      "https://go.xero.com/app/!short-code/invoicing/view/invoice-id",
    ],
    [
      "contact",
      DeepLinkType.CONTACT,
      "contact-id",
      "https://go.xero.com/app/!short-code/contacts/contact/contact-id",
    ],
  ])("creates a whitespace-free %s link", async (_name, type, id, expectedLink) => {
    await expect(getDeepLink(type, id)).resolves.toBe(expectedLink);
  });
});
