import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodRawShape } from "zod";

export interface ToolDefinition<Args extends ZodRawShape> {
  name: string;
  description: string;
  schema: Args;
  handler: ToolCallback<Args>;
}
