import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { listXeroInvoices } from "../../handlers/list-xero-invoices.handler.js";
import ListInvoicesTool from "./list-invoices.tool.js";

vi.mock("../../handlers/list-xero-invoices.handler.js", () => ({
  listXeroInvoices: vi.fn(),
}));

describe("list-invoices sent status", () => {
  it.each([
    { sentToContact: true, expected: "true" },
    { sentToContact: false, expected: "false" },
    { sentToContact: undefined, expected: "Unknown" },
  ])(
    "renders $sentToContact as $expected",
    async ({ sentToContact, expected }) => {
      vi.mocked(listXeroInvoices).mockResolvedValue({
        result: [{ invoiceNumber: "INV-1", sentToContact }],
        isError: false,
        error: null,
      });
      const server = new McpServer({ name: "test", version: "1" });
      const tool = ListInvoicesTool();
      server.tool(tool.name, tool.description, tool.schema, tool.handler);
      const client = new Client({ name: "test", version: "1" });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      try {
        const result = await client.callTool({
          name: "list-invoices",
          arguments: { page: 1 },
        });
        expect(result.isError).not.toBe(true);
        expect(result.content).toEqual([
          { type: "text", text: "Found 1 invoices:" },
          {
            type: "text",
            text: expect.stringContaining(`Sent to Contact: ${expected}\n`),
          },
        ]);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );
});
