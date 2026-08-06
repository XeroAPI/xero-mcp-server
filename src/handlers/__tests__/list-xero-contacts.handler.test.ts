import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getContacts: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getContacts: mocks.getContacts,
    },
  },
}));

import { listXeroContacts } from "../list-xero-contacts.handler.js";

describe("listXeroContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests full contacts and forwards the archived filter", async () => {
    mocks.getContacts.mockResolvedValue({ body: { contacts: [] } });

    const result = await listXeroContacts(2, "Ada", true);

    expect(result).toMatchObject({ result: [], isError: false, error: null });
    expect(mocks.getContacts).toHaveBeenCalledWith(
      "tenant-id",
      undefined,
      undefined,
      undefined,
      undefined,
      2,
      true,
      false,
      "Ada",
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
