import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroContact: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-contact.handler.js", () => ({
  createXeroContact: mocks.createXeroContact,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { CONTACT: "CONTACT" },
  getDeepLink: mocks.getDeepLink,
}));

import CreateContactTool from "./create-contact.tool.js";

describe("create-contact tool", () => {
  const tool = CreateContactTool();
  const schema = z.object(tool.schema as z.ZodRawShape);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createXeroContact.mockResolvedValue({
      result: { contactID: "contact-id", name: "Example contact" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);
  });

  it("forwards an idempotency key for safe retries", async () => {
    await tool.handler({
      name: "Example contact",
      idempotencyKey: "contact-create-retry-key",
    }, {} as never);

    expect(mocks.createXeroContact).toHaveBeenCalledWith(
      "Example contact",
      undefined,
      undefined,
      "contact-create-retry-key",
    );
  });

  it("limits idempotency keys to Xero's supported length", () => {
    expect(schema.safeParse({
      name: "Example contact",
      idempotencyKey: "x".repeat(128),
    }).success).toBe(true);
    expect(schema.safeParse({
      name: "Example contact",
      idempotencyKey: "x".repeat(129),
    }).success).toBe(false);
  });
});
