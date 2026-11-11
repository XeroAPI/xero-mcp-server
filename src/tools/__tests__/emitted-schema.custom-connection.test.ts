import { describe, it, expect, beforeAll, vi } from "vitest";

vi.hoisted(() => {
  delete process.env.XERO_CLIENT_BEARER_TOKEN;
  process.env.XERO_CLIENT_ID = "test-client-id";
  process.env.XERO_CLIENT_SECRET = "test-client-secret";
});

const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } =
  await import("@modelcontextprotocol/sdk/inMemory.js");
const { ToolFactory } = await import("../tool-factory.js");

interface EmittedTool {
  name: string;
  inputSchema: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

let tools: EmittedTool[];

beforeAll(async () => {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  ToolFactory(server);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  tools = (await client.listTools()).tools as unknown as EmittedTool[];
});

describe("emitted tool schemas (Custom Connection mode)", () => {
  it("offers tenantId on every tenanted tool without requiring it", () => {
    const tenanted = tools.filter((tool) => tool.name !== "list-tenants");

    expect(tenanted.length).toBeGreaterThan(40);

    const missingProperty = tenanted
      .filter(
        (tool) =>
          !Object.keys(tool.inputSchema.properties ?? {}).includes("tenantId"),
      )
      .map((tool) => tool.name);
    const wronglyRequired = tenanted
      .filter((tool) => (tool.inputSchema.required ?? []).includes("tenantId"))
      .map((tool) => tool.name);

    expect(missingProperty).toEqual([]);
    expect(wronglyRequired).toEqual([]);
  });
});
