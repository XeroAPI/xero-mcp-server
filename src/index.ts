#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ListContactsTool } from "./tools/list-contacts.tool.js";
import { ListInvoicesTool } from "./tools/list-invoices.tool.js";
import { CreateContactTool } from "./tools/create-contact.tool.js";
import { CreateInvoiceTool } from "./tools/create-invoice.tool.js";

// Create an MCP server
const server = XeroMcpServer.GetServer();

// Add tool to list contacts
ListContactsTool(server);

// Add tool to list invoices
ListInvoicesTool(server);

// Add a tool to create a contact
CreateContactTool(server);

// Add tool to create an invoice
CreateInvoiceTool(server);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
