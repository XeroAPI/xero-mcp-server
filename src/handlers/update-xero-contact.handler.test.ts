import { beforeEach, describe, expect, it, vi } from "vitest";
import { Contact } from "xero-node";

const authenticateMock = vi.fn();
const updateContactMock = vi.fn();
const getClientHeadersMock = vi.fn(() => ({ "x-test": "header" }));

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-123",
    authenticate: authenticateMock,
    accountingApi: {
      updateContact: updateContactMock,
    },
  },
}));

vi.mock("../helpers/get-client-headers.js", () => ({
  getClientHeaders: getClientHeadersMock,
}));

describe("updateXeroContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes default account codes, line amount types, and tracking categories through to Xero", async () => {
    updateContactMock.mockResolvedValue({
      body: { contacts: [{ contactID: "contact-1", name: "ACME" }] },
    });

    const { updateXeroContact } = await import("./update-xero-contact.handler.js");

    const result = await updateXeroContact(
      "contact-1",
      "ACME",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "400",
      "200",
      Contact.PurchasesDefaultLineAmountTypeEnum.EXCLUSIVE,
      Contact.SalesDefaultLineAmountTypeEnum.INCLUSIVE,
      [{ trackingCategoryName: "Department", trackingOptionName: "Finance" }],
      [{ trackingCategoryName: "Region", trackingOptionName: "EMEA" }],
    );

    expect(result.isError).toBe(false);
    expect(updateContactMock).toHaveBeenCalledWith(
      "tenant-123",
      "contact-1",
      {
        contacts: [
          expect.objectContaining({
            purchasesDefaultAccountCode: "400",
            salesDefaultAccountCode: "200",
            purchasesDefaultLineAmountType: "EXCLUSIVE",
            salesDefaultLineAmountType: "INCLUSIVE",
            purchasesTrackingCategories: [
              {
                trackingCategoryName: "Department",
                trackingOptionName: "Finance",
              },
            ],
            salesTrackingCategories: [
              {
                trackingCategoryName: "Region",
                trackingOptionName: "EMEA",
              },
            ],
          }),
        ],
      },
      undefined,
      { "x-test": "header" },
    );
  });
});
