import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("../handlers/create-xero-item.handler.js", () => ({
  createXeroItem: vi.fn(),
}));

vi.mock("../handlers/update-xero-item.handler.js", () => ({
  updateXeroItem: vi.fn(),
}));

import CreateItemTool from "./create/create-item.tool.js";
import UpdateItemTool from "./update/update-item.tool.js";

describe("item tool validation", () => {
  it("allows Xero's required code without a name when creating an item", () => {
    const schema = z.object(CreateItemTool().schema as z.ZodRawShape);

    expect(schema.safeParse({ code: "SKU-001" }).success).toBe(true);
  });

  it("allows a name-free item update", () => {
    const schema = z.object(UpdateItemTool().schema as z.ZodRawShape);

    expect(schema.safeParse({ itemId: "item-id", code: "SKU-001" }).success).toBe(true);
  });
});
