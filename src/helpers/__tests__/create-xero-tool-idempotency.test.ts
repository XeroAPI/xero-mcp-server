import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CreateXeroTool, MutationXeroTool } from "../create-xero-tool.js";
import { getCurrentIdempotencyKey } from "../idempotency-key.js";
import { MutationConfirmationStore } from "../mutation-confirmation.js";

function tokenFrom(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const content = result.content[0];
  const text = content?.type === "text" ? (content.text ?? "") : "";
  const match = text.match(/^Confirmation token: (.+)$/m);
  if (!match) throw new Error("Prepared response did not contain a token");
  return match[1];
}

describe("MutationXeroTool idempotency", () => {
  it("binds a caller key to confirmation and scopes it to execution", async () => {
    const handler = vi.fn(async (args: { amount: number }) => ({
      content: [
        {
          type: "text" as const,
          text: `${args.amount}:${getCurrentIdempotencyKey()}`,
        },
      ],
    }));
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => "synthetic-token",
    );
    const tool = MutationXeroTool(
      "update-example",
      "Update an example",
      { amount: z.number() },
      handler,
      { supportsIdempotency: true, confirmation },
    )();
    const extra = {
      requestId: "request-1",
      sessionId: "session-1",
    } as never;

    expect(tool.schema).toHaveProperty("idempotencyKey");
    const prepared = await tool.handler(
      {
        amount: 42,
        idempotencyKey: "caller-retry-key",
        confirmationAction: "prepare",
      },
      extra,
    );
    const preparedText =
      prepared.content[0]?.type === "text" ? prepared.content[0].text : "";
    expect(handler).not.toHaveBeenCalled();
    expect(preparedText).not.toContain("caller-retry-key");

    const result = await tool.handler(
      {
        amount: 42,
        idempotencyKey: "caller-retry-key",
        confirmationAction: "execute",
        confirmationToken: tokenFrom(prepared),
      },
      extra,
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

  it("requires a new preparation when the caller key changes", async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => "key-bound-token",
    );
    const tool = MutationXeroTool(
      "update-example",
      "Update an example",
      { amount: z.number() },
      handler,
      { supportsIdempotency: true, confirmation },
    )();
    const prepared = await tool.handler(
      {
        amount: 42,
        idempotencyKey: "key-a",
        confirmationAction: "prepare",
      },
      {} as never,
    );

    await expect(
      tool.handler(
        {
          amount: 42,
          idempotencyKey: "key-b",
          confirmationAction: "execute",
          confirmationToken: tokenFrom(prepared),
        },
        {} as never,
      ),
    ).rejects.toThrow("payload");
    expect(handler).not.toHaveBeenCalled();
  });

  it("derives different keys when a repeated request ID changes payload", async () => {
    let tokenCounter = 0;
    const keys: Array<string | undefined> = [];
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => `token-${tokenCounter += 1}`,
    );
    const tool = MutationXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      async () => {
        keys.push(getCurrentIdempotencyKey());
        return { content: [] };
      },
      { supportsIdempotency: true, confirmation },
    )();
    const extra = { requestId: "request-1", sessionId: "session-1" } as never;

    for (const amount of [42, 43]) {
      const prepared = await tool.handler(
        { amount, confirmationAction: "prepare" },
        extra,
      );
      await tool.handler(
        {
          amount,
          confirmationAction: "execute",
          confirmationToken: tokenFrom(prepared),
        },
        extra,
      );
    }

    expect(keys[0]).toMatch(/^xero-mcp-[a-f0-9]{64}$/);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("omits an unsupported key while keeping the mutation gate", () => {
    const confirmation = new MutationConfirmationStore(async () => ({
      organisationId: "synthetic-organisation",
    }));
    const tool = MutationXeroTool(
      "delete-example",
      "Delete an example",
      { exampleId: z.string() },
      vi.fn(),
      { supportsIdempotency: false, confirmation },
    )();

    expect(tool.schema).not.toHaveProperty("idempotencyKey");
    expect(tool.schema).toHaveProperty("confirmationAction");
    expect(tool.schema).toHaveProperty("confirmationToken");
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
    expect(tool.schema).not.toHaveProperty("confirmationAction");
    expect(tool.schema).not.toHaveProperty("confirmationToken");
    await tool.handler({ accountId: "synthetic-id" }, {} as never);
    expect(handler).toHaveBeenCalledWith({ accountId: "synthetic-id" }, {});
  });
});
