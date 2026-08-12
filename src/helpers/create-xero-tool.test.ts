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

  it("redacts sensitive fields and bounds preview output", async () => {
    const handler = vi.fn();
    const tool = CreateXeroTool(
      "create-contact",
      "Create a contact",
      {
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        bankAccountId: z.string(),
        notes: z.string(),
      },
      handler,
    )();

    const result = await tool.handler(
      {
        name: "Synthetic Person",
        email: "person@example.test",
        phone: "0400000000",
        bankAccountId: "synthetic-bank-id",
        notes: "x".repeat(20_000),
        dryRun: true,
      },
      {} as never,
    );
    const text =
      result.content[0].type === "text" ? result.content[0].text : "";

    expect(handler).not.toHaveBeenCalled();
    expect(text).toContain("[redacted]");
    expect(text).not.toContain("person@example.test");
    expect(text).not.toContain("0400000000");
    expect(text).not.toContain("synthetic-bank-id");
    expect(text.length).toBeLessThan(9_000);
  });

  it("keeps dryRun optional and strips unknown fields before the handler", async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const tool = CreateXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      handler,
    )();

    expect(
      (tool.schema.dryRun as z.ZodTypeAny).safeParse(undefined).success,
    ).toBe(true);
    await tool.handler(
      { amount: 42, unknownControl: "must-not-leak" } as never,
      {} as never,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual({ amount: 42 });
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
