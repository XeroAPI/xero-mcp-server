import { ZodRawShape, z } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types/tool-definition.js";

// Base schema that includes bearer token parameter
const baseSchema = {
  bearerToken: z.string().describe("Xero bearer token for authentication"),
};

export const CreateXeroTool =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <Args extends undefined | ZodRawShape = any>(
    name: string,
    description: string,
    schema: Args,
    handler: ToolCallback<Args & typeof baseSchema>,
  ): (() => ToolDefinition<Args & typeof baseSchema>) =>
    () => ({
      name: name,
      description: description,
      schema: { ...baseSchema, ...schema },
      handler: handler,
    });
