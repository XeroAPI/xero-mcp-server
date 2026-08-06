import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroContactGroups: vi.fn(),
}));

vi.mock("../../handlers/list-xero-contact-groups.handler.js", () => ({
  listXeroContactGroups: mocks.listXeroContactGroups,
}));

import ListContactGroupsTool from "./list-contact-groups.tool.js";

describe("list-contact-groups tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not mistake omitted collection members for an empty group", async () => {
    mocks.listXeroContactGroups.mockResolvedValue({
      result: [{ contactGroupID: "group-id", name: "Customers", status: "ACTIVE" }],
      isError: false,
      error: null,
    });

    const result = await ListContactGroupsTool().handler({}, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining("Provide contactGroupId to retrieve this group's contacts"),
    });
    expect(result.content[1]).not.toMatchObject({
      text: expect.stringContaining("No contacts in this contact group"),
    });
  });

  it("identifies a specifically retrieved empty group accurately", async () => {
    mocks.listXeroContactGroups.mockResolvedValue({
      result: [{ contactGroupID: "group-id", name: "Customers", status: "ACTIVE", contacts: [] }],
      isError: false,
      error: null,
    });

    const result = await ListContactGroupsTool().handler(
      { contactGroupId: "group-id" },
      {} as never,
    );

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining("No contacts in this contact group"),
    });
  });

  it("rejects a blank contact group ID", () => {
    const schema = z.object(ListContactGroupsTool().schema as z.ZodRawShape);

    expect(schema.safeParse({ contactGroupId: "   " }).success).toBe(false);
    expect(schema.safeParse({ contactGroupId: "group-id" }).success).toBe(true);
  });
});
