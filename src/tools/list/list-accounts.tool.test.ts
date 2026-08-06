import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroAccounts: vi.fn(),
}));

vi.mock("../../handlers/list-xero-accounts.handler.js", () => ({
  listXeroAccounts: mocks.listXeroAccounts,
}));

import ListAccountsTool from "./list-accounts.tool.js";

describe("list-accounts tool", () => {
  const tool = ListAccountsTool();

  it("shows whether accounts can receive payments, including false", async () => {
    mocks.listXeroAccounts.mockResolvedValue({
      result: [
        {
          name: "Payment clearing",
          code: "800",
          enablePaymentsToAccount: true,
        },
        {
          name: "Revenue",
          code: "200",
          enablePaymentsToAccount: false,
        },
      ],
      isError: false,
      error: null,
    });

    const result = await tool.handler({}, {} as never);

    expect(result.content).toContainEqual(expect.objectContaining({
      type: "text",
      text: expect.stringContaining("Payments Enabled: Yes"),
    }));
    expect(result.content).toContainEqual(expect.objectContaining({
      type: "text",
      text: expect.stringContaining("Payments Enabled: No"),
    }));
  });
});
