import { ZodRawShape } from "zod";
import { ToolDefinition } from "../types/tool-definition.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const RegisterTool = <Args extends ZodRawShape>(
  server: McpServer,
  toolDefinition: ToolDefinition<Args>,
) => {
  server.tool(
    toolDefinition.name,
    toolDefinition.description,
    toolDefinition.schema,
    toolDefinition.handler,
  );
};
