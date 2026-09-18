import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CreateTools } from "./create/index.js";
import { DeleteTools } from "./delete/index.js";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";
import { UpdateTools } from "./update/index.js";
import { XERO_OAUTH_SCOPES } from "../xero-oauth-scopes.js";
import { BookkeepingTools } from "../bookkeeping/tools.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";

const xeroSecuritySchemes = [
  { type: "oauth2" as const, scopes: XERO_OAUTH_SCOPES },
];

export function ToolFactory(server: McpServer) {
  const registerTool = <Args extends ZodRawShapeCompat | AnySchema>(
    tool: ToolDefinition<Args>,
  ) =>
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        // The current MCP SDK exposes this compatibility field. ChatGPT reads
        // it when determining which Xero OAuth scopes a tool requires.
        _meta: { securitySchemes: xeroSecuritySchemes },
      },
      tool.handler,
    );

  DeleteTools.map((tool) => tool()).forEach((tool) =>
    registerTool(tool),
  );
  GetTools.map((tool) => tool()).forEach((tool) =>
    registerTool(tool),
  );
  CreateTools.map((tool) => tool()).forEach((tool) =>
    registerTool(tool),
  );
  ListTools.map((tool) => tool()).forEach((tool) =>
    registerTool(tool),
  );
  UpdateTools.map((tool) => tool()).forEach((tool) =>
    registerTool(tool),
  );
  BookkeepingTools.map((tool) => tool()).forEach((tool) =>
    registerTool(tool as unknown as ToolDefinition<ZodRawShapeCompat>),
  );
}
