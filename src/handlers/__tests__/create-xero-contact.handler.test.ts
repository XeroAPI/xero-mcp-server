import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createContacts: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createContacts: mocks.createContacts,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroContact } from "../create-xero-contact.handler.js";

describe("createXeroContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createContacts.mockResolvedValue({
      body: { contacts: [{ contactID: "contact-id", name: "Example contact" }] },
    });
  });

  it("forwards an idempotency key for safe contact-creation retries", async () => {
    const result = await createXeroContact(
      "Example contact",
      undefined,
      undefined,
      "contact-create-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createContacts).toHaveBeenCalledWith(
      "tenant-id",
      expect.objectContaining({ contacts: [expect.objectContaining({ name: "Example contact" })] }),
      true,
      "contact-create-retry-key",
      { headers: {} },
    );
  });
});
