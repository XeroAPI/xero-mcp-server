import { describe, it, expect, beforeAll, vi } from "vitest";

vi.hoisted(() => {
  process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
});

const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } =
  await import("@modelcontextprotocol/sdk/inMemory.js");
const { ToolFactory } = await import("../tool-factory.js");
const { xeroClient } = await import("../../clients/xero-client.js");

interface EmittedTool {
  name: string;
  inputSchema: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

let tools: EmittedTool[];
let client: InstanceType<typeof Client>;

beforeAll(async () => {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  ToolFactory(server);

  client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  tools = (await client.listTools()).tools as unknown as EmittedTool[];
});

describe("emitted tool schemas (bearer token mode)", () => {
  it("exposes the whole tool surface", () => {
    expect(tools.length).toBeGreaterThan(40);
    expect(tools.map((tool) => tool.name)).toContain("list-tenants");
  });

  it("marks tenantId required on every tenanted tool", () => {
    const missing = tools
      .filter((tool) => tool.name !== "list-tenants")
      .filter((tool) => !(tool.inputSchema.required ?? []).includes("tenantId"))
      .map((tool) => tool.name);

    expect(missing).toEqual([]);
  });

  it("does not require a tenantId on list-tenants", () => {
    const listTenants = tools.find((tool) => tool.name === "list-tenants");

    expect(listTenants?.inputSchema.required ?? []).not.toContain("tenantId");
    expect(
      Object.keys(listTenants?.inputSchema.properties ?? {}),
    ).not.toContain("tenantId");
  });

  it("rejects a call that omits tenantId at the protocol layer", async () => {
    // Schema validation happens in the MCP SDK, before this server's tenant
    // resolution runs, so the caller sees the SDK's invalid-arguments error.
    const result = (await client.callTool({
      name: "list-accounts",
      arguments: {},
    })) as { isError?: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Invalid arguments/);
    expect(result.content[0].text).toMatch(/tenantId/);
  });

  it("rejects a blank tenantId with the fail-closed message", async () => {
    vi.spyOn(xeroClient, "authenticate").mockResolvedValue();

    const result = (await client.callTool({
      name: "list-accounts",
      arguments: { tenantId: "  " },
    })) as { isError?: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/requires a tenantId/);
  });
});
