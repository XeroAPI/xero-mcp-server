import { describe, it, expect } from "vitest";
import { vi } from "vitest";

vi.hoisted(() => {
  process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
});

const { CreateTools } = await import("../create/index.js");
const { DeleteTools } = await import("../delete/index.js");
const { GetTools } = await import("../get/index.js");
const { ListTools } = await import("../list/index.js");
const { UpdateTools } = await import("../update/index.js");
const { safeParse } =
  await import("@modelcontextprotocol/sdk/server/zod-compat.js");

const allTools = [
  ...CreateTools,
  ...DeleteTools,
  ...GetTools,
  ...ListTools,
  ...UpdateTools,
].map((tool) => tool());

const NON_TENANTED_TOOLS = ["list-tenants"];

describe("tool schemas (bearer token mode)", () => {
  it("registers a meaningful number of tools", () => {
    expect(allTools.length).toBeGreaterThan(40);
  });

  it.each(
    allTools
      .filter((tool) => !NON_TENANTED_TOOLS.includes(tool.name))
      .map((tool) => [tool.name, tool] as const),
  )("%s requires a tenantId", (_name, tool) => {
    const schema = tool.schema as Record<string, unknown>;
    expect(Object.keys(schema)).toContain("tenantId");

    const tenantIdSchema = schema.tenantId as Parameters<typeof safeParse>[0];
    expect(safeParse(tenantIdSchema, undefined).success).toBe(false);
    expect(safeParse(tenantIdSchema, "a-tenant-id").success).toBe(true);
  });

  it.each(NON_TENANTED_TOOLS)("%s does not require a tenantId", (name) => {
    const tool = allTools.find((candidate) => candidate.name === name);
    expect(tool, `${name} tool is not registered`).toBeDefined();

    const schema = (tool?.schema ?? {}) as Record<string, unknown>;
    const tenantIdSchema = schema.tenantId as
      | Parameters<typeof safeParse>[0]
      | undefined;

    if (tenantIdSchema) {
      expect(safeParse(tenantIdSchema, undefined).success).toBe(true);
    }
  });
});
