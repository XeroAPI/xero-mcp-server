#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ListContactsTool } from "./tools/list-contacts.tool.js";
import { ListInvoicesTool } from "./tools/list-invoices.tool.js";
import { CreateContactTool } from "./tools/create-contact.tool.js";
import { CreateInvoiceTool } from "./tools/create-invoice.tool.js";
import { RegisterTool } from "./helpers/register-tool.js";
import { ListAccountsTool } from "./tools/list-accounts.tool.js";
import { ListTaxRatesTool } from "./tools/list-tax-rates.tool.js";
import { ListQuotesTool } from "./tools/list-quotes.tool.js";
import { CreateQuoteTool } from "./tools/create-quote.tool.js";
import { UpdateContactTool } from "./tools/update-contact.tool.js";
import { UpdateInvoiceTool } from "./tools/update-invoice.tool.js";
import { ListCreditNotesTool } from "./tools/list-credit-notes.tool.js";
import { CreateCreditNoteTool } from "./tools/create-credit-note.tool.js";

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

  // Add tool to list tax rates
  RegisterTool(server, ListTaxRatesTool);

  // Add tool to list quotes
  RegisterTool(server, ListQuotesTool);

  // Add tool to create a quote
  RegisterTool(server, CreateQuoteTool);

  // Add tool to update a contact
  RegisterTool(server, UpdateContactTool);

  // Add tool to update an invoice
  RegisterTool(server, UpdateInvoiceTool);

  // Add tool to list credit notes
  RegisterTool(server, ListCreditNotesTool);

  // Add tool to create a credit note
  RegisterTool(server, CreateCreditNoteTool);

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
