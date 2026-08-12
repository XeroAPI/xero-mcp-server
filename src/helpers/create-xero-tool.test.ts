import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CreateXeroTool } from "./create-xero-tool.js";

describe("CreateXeroTool dry-run support", () => {
  it("returns a payload preview without invoking the create handler", async () => {
    const handler = vi.fn();
    const tool = CreateXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      handler,
    )();

    const result = await tool.handler(
      { amount: 42, dryRun: true },
      {} as never,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining('"amount": 42'),
    });
  });

  it("removes the dry-run control before calling the create handler", async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const tool = CreateXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      handler,
    )();

    await tool.handler({ amount: 42, dryRun: false }, {} as never);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual({ amount: 42 });
  });
});
