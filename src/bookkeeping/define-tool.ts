import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShapeOutput, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { runTool } from "./tool-result.js";

export function defineBookkeepingTool<Args extends ZodRawShapeCompat>(
  name: string,
  description: string,
  schema: Args,
  work: (args: ShapeOutput<Args>) => Promise<unknown>,
): () => ToolDefinition<Args> {
  const handler = (async (args: ShapeOutput<Args>) =>
    (await runTool(() => work(args))) as CallToolResult) as unknown as ToolCallback<Args>;

  return () => ({
    name,
    description,
    schema,
    handler,
  });
}
