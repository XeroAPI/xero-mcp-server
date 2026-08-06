import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    getShortCode: vi.fn(),
  },
}));

import { xeroClient } from "../../clients/xero-client.js";
import { DeepLinkType, getDeepLink } from "../get-deeplink.js";

const getShortCode = vi.mocked(xeroClient.getShortCode);

describe("getDeepLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not turn a successful mutation into an error when the optional link lookup fails", async () => {
    getShortCode.mockRejectedValue(new Error("Organisation lookup failed"));

    await expect(
      getDeepLink(DeepLinkType.INVOICE, "invoice-id"),
    ).resolves.toBeNull();
  });

  it("returns no link when the organisation has no short code", async () => {
    getShortCode.mockResolvedValue(undefined);

    await expect(
      getDeepLink(DeepLinkType.INVOICE, "invoice-id"),
    ).resolves.toBeNull();
  });
});
