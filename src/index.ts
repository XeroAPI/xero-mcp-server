#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ListContactsTool } from "./tools/list-contacts.tool.js";
import { ListInvoicesTool } from "./tools/list-invoices.tool.js";
import { CreateContactTool } from "./tools/create-contact.tool.js";
import { CreateInvoiceTool } from "./tools/create-invoice.tool.js";
import { RegisterTool } from "./helpers/register-tool.js";
import { ListAccountsTool } from "./tools/list-accounts.tool.js";

const main = async () => {
  // Create an MCP server
  const server = XeroMcpServer.GetServer();

  // Add tool to list contacts
  RegisterTool(server, ListContactsTool);

  // Add tool to list invoices
  RegisterTool(server, ListInvoicesTool);

  // Add a tool to create a contact
  RegisterTool(server, CreateContactTool);

  // Add tool to create an invoice
  RegisterTool(server, CreateInvoiceTool);

  // Add tool to list accounts
  RegisterTool(server, ListAccountsTool);

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
