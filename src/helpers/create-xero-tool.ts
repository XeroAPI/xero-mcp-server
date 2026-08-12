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

const MAX_PREVIEW_CHARS = 8_000;
const MAX_PREVIEW_STRING_CHARS = 500;
const MAX_PREVIEW_ITEMS = 50;
const SENSITIVE_KEY =
  /(?:authorization|token|secret|password|api.?key|bank.?account|account.?number|routing|bsb|email|phone|address|employee.?id|contact.?ids?|first.?name|last.?name|tax.?number)/i;

function sanitisePreview(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (depth >= 8) return "[truncated: maximum depth reached]";
  if (typeof value === "string") {
    return value.length <= MAX_PREVIEW_STRING_CHARS
      ? value
      : `${value.slice(0, MAX_PREVIEW_STRING_CHARS)}… [truncated]`;
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_PREVIEW_ITEMS)
      .map((item) => sanitisePreview(item, key, depth + 1));
    if (value.length > MAX_PREVIEW_ITEMS) {
      items.push(`[truncated: ${value.length - MAX_PREVIEW_ITEMS} more items]`);
    }
    return items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_PREVIEW_ITEMS)
        .map(([childKey, child]) => [
          childKey,
          sanitisePreview(child, childKey, depth + 1),
        ]),
    );
  }
  return value;
}

function serialisePreview(payload: unknown): string {
  const serialised = JSON.stringify(sanitisePreview(payload), null, 2);
  return serialised.length <= MAX_PREVIEW_CHARS
    ? serialised
    : `${serialised.slice(0, MAX_PREVIEW_CHARS)}\n[preview truncated]`;
}

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
    const parsed = z.object(createSchema as z.ZodRawShape).parse(args);
    const { dryRun: previewOnly, ...payload } = parsed;
    if (previewOnly) {
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Preview only: ${name} was not sent to Xero.`,
              "Personal, bank and credential fields are redacted; long values may be truncated.",
              serialisePreview(payload),
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
