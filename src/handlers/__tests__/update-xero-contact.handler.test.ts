import { beforeEach, describe, expect, it, vi } from "vitest";
import { Address, Contact, Phone } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      updateContact: mocks.updateContact,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { updateXeroContact } from "../update-xero-contact.handler.js";

describe("updateXeroContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateContact.mockResolvedValue({
      body: { contacts: [{ contactID: "contact-id", name: "Example contact" }] },
    });
  });

  it("sends a status-only contact update to Xero", async () => {
    const result = await updateXeroContact(
      "contact-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      Contact.ContactStatusEnum.ARCHIVED,
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateContact).toHaveBeenCalledWith(
      "tenant-id",
      "contact-id",
      {
        contacts: [
          expect.objectContaining({
            contactStatus: Contact.ContactStatusEnum.ARCHIVED,
          }),
        ],
      },
      undefined,
      { headers: {} },
    );
  });

  it("does not silently drop an explicitly supplied empty phone value", async () => {
    const result = await updateXeroContact(
      "contact-id",
      undefined,
      undefined,
      undefined,
      undefined,
      "",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateContact).toHaveBeenCalledWith(
      "tenant-id",
      "contact-id",
      {
        contacts: [
          expect.objectContaining({
            phones: [
              {
                phoneNumber: "",
                phoneType: "MOBILE",
              },
            ],
          }),
        ],
      },
      undefined,
      { headers: {} },
    );
  });

  it("preserves the supplied phone type and dialing codes", async () => {
    const result = await updateXeroContact(
      "contact-id",
      undefined,
      undefined,
      undefined,
      undefined,
      "5551234",
      undefined,
      undefined,
      Phone.PhoneTypeEnum.OFFICE,
      "64",
      "04",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateContact).toHaveBeenCalledWith(
      "tenant-id",
      "contact-id",
      {
        contacts: [
          expect.objectContaining({
            phones: [
              {
                phoneNumber: "5551234",
                phoneType: Phone.PhoneTypeEnum.OFFICE,
                phoneCountryCode: "64",
                phoneAreaCode: "04",
              },
            ],
          }),
        ],
      },
      undefined,
      { headers: {} },
    );
  });

  it("preserves a supplied PO Box address type", async () => {
    const result = await updateXeroContact(
      "contact-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        addressLine1: "PO Box 123",
        addressType: Address.AddressTypeEnum.POBOX,
      },
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateContact).toHaveBeenCalledWith(
      "tenant-id",
      "contact-id",
      {
        contacts: [
          expect.objectContaining({
            addresses: [
              expect.objectContaining({
                addressLine1: "PO Box 123",
                addressType: Address.AddressTypeEnum.POBOX,
              }),
            ],
          }),
        ],
      },
      undefined,
      { headers: {} },
    );
  });

  it("forwards an idempotency key for safe contact-update retries", async () => {
    const result = await updateXeroContact(
      "contact-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "contact-update-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateContact.mock.calls[0][3]).toBe("contact-update-retry-key");
  });
});
