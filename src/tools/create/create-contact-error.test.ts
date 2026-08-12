import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroContact: vi.fn(),
}));

vi.mock("../../handlers/create-xero-contact.handler.js", () => ({
  createXeroContact: mocks.createXeroContact,
}));
vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { CONTACT: "CONTACT" },
  getDeepLink: vi.fn(),
}));

import CreateContactTool from "./create-contact.tool.js";

describe("create-contact error boundary", () => {
  afterEach(() => {
    delete process.env.XERO_CLIENT_SECRET;
    vi.clearAllMocks();
  });

  it("sanitises and bounds an Error before returning MCP text", async () => {
    process.env.XERO_CLIENT_SECRET = "KNOWN_CONTACT_SECRET";
    mocks.createXeroContact.mockRejectedValue(
      new Error(
        "Contact validation failed\r\n"
          + "Authorization: Bearer CONTACT_BEARER\r\n"
          + "Cookie: session=CONTACT_COOKIE\r\n"
          + `KNOWN_CONTACT_SECRET ${"x".repeat(2_000)}`,
      ),
    );
    const tool = CreateContactTool();
    const handler = tool.handler as unknown as (
      args: { name: string },
      extra: Record<string, never>,
    ) => Promise<{ content: Array<{ type: string; text: string }> }>;

    const result = await handler({ name: "Synthetic Contact" }, {});
    const text = result.content[0]!.text;

    expect(text).toContain("Contact validation failed");
    expect(text.length).toBeLessThanOrEqual(1_024);
    expect(text).not.toMatch(/[\r\n]/);
    expect(text).not.toContain("CONTACT_BEARER");
    expect(text).not.toContain("CONTACT_COOKIE");
    expect(text).not.toContain("KNOWN_CONTACT_SECRET");
  });
});
