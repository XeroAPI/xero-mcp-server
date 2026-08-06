import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateXeroContact: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/update-xero-contact.handler.js", () => ({
  updateXeroContact: mocks.updateXeroContact,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    CONTACT: "CONTACT",
  },
  getDeepLink: mocks.getDeepLink,
}));

import UpdateContactTool from "./update-contact.tool.js";

describe("update-contact tool", () => {
  const tool = UpdateContactTool();
  const schema = z.object(tool.schema as z.ZodRawShape);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts and forwards an email-only update", async () => {
    expect(schema.safeParse({
      contactId: "contact-id",
      email: "contact@example.com",
    }).success).toBe(true);

    mocks.updateXeroContact.mockResolvedValue({
      result: { contactID: "contact-id", name: "Example contact" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await tool.handler({
      contactId: "contact-id",
      email: "contact@example.com",
    }, {} as never);

    expect(mocks.updateXeroContact).toHaveBeenCalledWith(
      "contact-id",
      undefined,
      undefined,
      undefined,
      "contact@example.com",
      undefined,
      undefined,
    );
  });

  it("does not send an empty update to Xero", async () => {
    const result = await tool.handler({ contactId: "contact-id" }, {} as never);

    expect(mocks.updateXeroContact).not.toHaveBeenCalled();
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Provide at least one contact field to update"),
    });
  });
});
