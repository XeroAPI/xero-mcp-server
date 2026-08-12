import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types/tool-definition.js";
import {
  ShapeOutput,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z } from "zod";

const dryRun = z
  .boolean()
  .optional()
  .describe("Preview the proposed create without calling Xero");

export const CreateXeroTool = <Args extends ZodRawShapeCompat>(
  name: string,
  description: string,
  schema: Args,
  handler: ToolCallback<Args>,
): (() => ToolDefinition<ZodRawShapeCompat>) => {
  const createSchema: ZodRawShapeCompat = { ...schema, dryRun };
  const createHandler: ToolCallback<ZodRawShapeCompat> = async (
    args,
    extra,
  ) => {
    const { dryRun: previewOnly, ...payload } = args;
    if (previewOnly) {
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Preview only: ${name} was not sent to Xero.`,
              JSON.stringify(payload, null, 2),
            ].join("\n"),
          },
        ],
      };
    }
    return handler(payload as ShapeOutput<Args>, extra);
  };

  return () => ({
    name,
    description,
    schema: createSchema,
    handler: createHandler,
  });
};
