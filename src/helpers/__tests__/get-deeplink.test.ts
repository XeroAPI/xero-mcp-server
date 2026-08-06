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
});
