import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CreateXeroTool, MutationXeroTool } from "../create-xero-tool.js";
import { getCurrentIdempotencyKey } from "../idempotency-key.js";

describe("MutationXeroTool idempotency", () => {
  it("adds one common optional key and scopes it to every mutation handler", async () => {
    const handler = vi.fn(async (args: { amount: number }) => ({
      content: [
        {
          type: "text" as const,
          text: `${args.amount}:${getCurrentIdempotencyKey()}`,
        },
      ],
    }));
    const tool = MutationXeroTool(
      "update-example",
      "Update an example",
      { amount: z.number() },
      handler,
    )();

    expect(tool.schema).toHaveProperty("idempotencyKey");
    const result = await tool.handler(
      { amount: 42, idempotencyKey: "caller-retry-key" },
      { requestId: "request-1", sessionId: "session-1" } as never,
    );

    expect(result.content[0]).toEqual({
      type: "text",
      text: "42:caller-retry-key",
    });
    expect(handler).toHaveBeenCalledWith(
      { amount: 42 },
      expect.objectContaining({ requestId: "request-1" }),
    );
    expect(getCurrentIdempotencyKey()).toBeUndefined();
  });

  it("derives different keys when a repeated request ID changes payload", async () => {
    const keys: Array<string | undefined> = [];
    const tool = MutationXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      async () => {
        keys.push(getCurrentIdempotencyKey());
        return { content: [] };
      },
    )();
    const extra = { requestId: "request-1", sessionId: "session-1" } as never;

    await tool.handler({ amount: 42 }, extra);
    await tool.handler({ amount: 43 }, extra);

    expect(keys[0]).toMatch(/^xero-mcp-[a-f0-9]{64}$/);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("keeps read-only schemas and handlers byte-compatible", async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const schema = { accountId: z.string() };
    const tool = CreateXeroTool(
      "list-example",
      "List an example",
      schema,
      handler,
    )();

    expect(tool.schema).toBe(schema);
    expect(tool.schema).not.toHaveProperty("idempotencyKey");
    await tool.handler({ accountId: "synthetic-id" }, {} as never);
    expect(handler).toHaveBeenCalledWith({ accountId: "synthetic-id" }, {});
  });
});
