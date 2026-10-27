import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Joins the text blocks of a tool result into one block.
 *
 * Most tools here answer with a header block ("Found 1 contacts:") followed by
 * one block per record. Some MCP clients pass only the first text block of a
 * result to the model (seen with OpenAI's hosted MCP tool, October 2026), so
 * the model sees the header and never the records. One block keeps the text
 * the same and lets every client read all of it.
 */
export function joinTextContent(result: CallToolResult): CallToolResult {
  const content = result.content ?? [];
  if (content.length < 2 || !content.every((block) => block.type === "text")) {
    return result;
  }
  return {
    ...result,
    content: [
      {
        type: "text",
        text: content
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("\n"),
      },
    ],
  };
}

/** Wraps a tool handler so that its result reaches the client as one text block. */
export const withOneTextBlock =
  (handler: ToolCallback<ZodRawShapeCompat>): ToolCallback<ZodRawShapeCompat> =>
  async (args, extra) =>
    joinTextContent(await handler(args, extra));
