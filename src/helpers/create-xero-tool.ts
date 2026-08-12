import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types/tool-definition.js";
import {
  ShapeOutput,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import {
  idempotencyKeySchema,
  resolveIdempotencyKey,
  runWithIdempotencyKey,
} from "./idempotency-key.js";
import { z } from "zod";

export const CreateXeroTool = <Args extends ZodRawShapeCompat>(
  name: string,
  description: string,
  schema: Args,
  handler: ToolCallback<Args>,
): (() => ToolDefinition<ZodRawShapeCompat>) =>
  () => ({
    name,
    description,
    schema,
    handler,
  });

export const MutationXeroTool = <Args extends ZodRawShapeCompat>(
  name: string,
  description: string,
  schema: Args,
  handler: ToolCallback<Args>,
): (() => ToolDefinition<ZodRawShapeCompat>) => {
  const hasExplicitKey = Object.hasOwn(schema, "idempotencyKey");
  const mutationSchema: ZodRawShapeCompat = {
    ...schema,
    idempotencyKey: idempotencyKeySchema
      .optional()
      .describe("Optional key to reuse only when retrying this same mutation"),
  };
  const mutationHandler: ToolCallback<ZodRawShapeCompat> = async (
    args,
    extra,
  ) => {
    const parsed = z.object(mutationSchema as z.ZodRawShape).parse(args);
    const { idempotencyKey, ...payload } = parsed;
    const key = resolveIdempotencyKey(
      name,
      extra.requestId,
      idempotencyKey,
      extra.sessionId,
      payload,
    );
    const handlerArgs = hasExplicitKey ? parsed : payload;
    return runWithIdempotencyKey(key, () =>
      handler(handlerArgs as ShapeOutput<Args>, extra),
    );
  };

  return () => ({
    name,
    description,
    schema: mutationSchema,
    handler: mutationHandler,
  });
};
