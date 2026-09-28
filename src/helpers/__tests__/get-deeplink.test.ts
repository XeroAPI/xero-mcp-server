import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockXeroClient,
  resetXeroClientMocks,
} from "../../handlers/__tests__/mock-xero-client.js";

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { DeepLinkType, getDeepLink } from "../get-deeplink.js";

describe("getDeepLink", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("builds a purchase order deep link from the org short code", async () => {
    const link = await getDeepLink(DeepLinkType.PURCHASE_ORDER, "po-1");
    expect(link).toBe("https://go.xero.com/app/!abc/purchase-orders/view/po-1");
  });
});
