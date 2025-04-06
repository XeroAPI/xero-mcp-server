import { ZodRawShape } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types/tool-definition.js";

export const CreateXeroTool =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <Args extends undefined | ZodRawShape = any>(
      name: string,
      description: string,
      schema: Args,
      handler: ToolCallback<Args>,
    ): (() => ToolDefinition<Args>) =>
    () => ({
      name: name,
      description: description,
      schema: schema,
      handler: handler,
    });
