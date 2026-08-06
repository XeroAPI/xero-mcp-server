import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getContactGroup: vi.fn(),
  getContactGroups: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getContactGroup: mocks.getContactGroup,
      getContactGroups: mocks.getContactGroups,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { listXeroContactGroups } from "../list-xero-contact-groups.handler.js";

describe("listXeroContactGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a blank supplied ID instead of listing every contact group", async () => {
    const result = await listXeroContactGroups("   ");

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Contact group ID must not be blank.",
    });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.getContactGroup).not.toHaveBeenCalled();
    expect(mocks.getContactGroups).not.toHaveBeenCalled();
  });

  it("trims a supplied contact group ID before retrieving that group", async () => {
    mocks.getContactGroup.mockResolvedValue({
      body: { contactGroups: [{ contactGroupID: "group-id" }] },
    });

    const result = await listXeroContactGroups(" group-id ");

    expect(result).toMatchObject({ isError: false, error: null });
    expect(mocks.getContactGroup).toHaveBeenCalledWith(
      "tenant-id",
      "group-id",
      { headers: {} },
    );
    expect(mocks.getContactGroups).not.toHaveBeenCalled();
  });
});
