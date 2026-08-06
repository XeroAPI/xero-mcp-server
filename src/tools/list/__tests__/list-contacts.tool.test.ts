import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../handlers/list-xero-contacts.handler.js", () => ({
  listXeroContacts: vi.fn(),
}));

import { listXeroContacts } from "../../../handlers/list-xero-contacts.handler.js";
import ListContactsTool from "../list-contacts.tool.js";

const listContacts = vi.mocked(listXeroContacts);

describe("list-contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listContacts.mockResolvedValue({
      result: [],
      isError: false,
      error: null,
    });
  });

  it("forwards the archived-contact option to the handler", async () => {
    const response = await ListContactsTool().handler(
      { page: 2, searchTerm: "Ada", includeArchived: true },
      {} as never,
    );

    expect(listContacts).toHaveBeenCalledWith(2, "Ada", true);
    expect(response.content).toEqual([
      { type: "text", text: "Found 0 contacts (page 2):" },
    ]);
  });
});
