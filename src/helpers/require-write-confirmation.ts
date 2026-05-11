import { z } from "zod";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { ToolDefinition } from "../types/tool-definition.js";

export type WriteAction = "create" | "update" | "delete" | "approve" | "revert";

const confirmField = z
  .boolean()
  .optional()
  .describe(
    "Set to true to actually execute this write. If omitted or false, the tool returns a preview describing what would happen and does NOT call Xero. After receiving a preview, show it to the user verbatim, summarize the impact in plain English, and wait for explicit approval before re-calling with confirm: true.",
  );

export function requireWriteConfirmation(
  action: WriteAction,
  tool: ToolDefinition<ZodRawShapeCompat>,
): ToolDefinition<ZodRawShapeCompat> {
  const wrappedSchema: ZodRawShapeCompat = {
    ...(tool.schema as ZodRawShapeCompat),
    confirm: confirmField,
  };

  const wrappedHandler = (async (args: Record<string, unknown>, extra: unknown) => {
    const confirmed = args?.confirm === true;
    const rest = { ...(args ?? {}) };
    delete rest.confirm;

    if (!confirmed) {
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `[CONFIRMATION REQUIRED — no data was written]`,
              `Tool: ${tool.name} (${action})`,
              ``,
              `Proposed parameters:`,
              "```json",
              JSON.stringify(rest, null, 2),
              "```",
              ``,
              `Show this preview to the user, summarize what it will do in plain English, and wait for their explicit approval. To execute, re-call ${tool.name} with the same parameters plus "confirm": true.`,
            ].join("\n"),
          },
        ],
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tool.handler as any)(rest, extra);
  }) as ToolDefinition<ZodRawShapeCompat>["handler"];

  return {
    name: tool.name,
    description:
      `${tool.description}\n\n[REQUIRES CONFIRMATION] First call returns a preview only. Re-call with confirm=true after the user explicitly approves.`,
    schema: wrappedSchema,
    handler: wrappedHandler,
  };
}
