import { z } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { isCustomConnectionMode } from "../clients/xero-client.js";
import { resolveTenant } from "../clients/resolve-tenant.js";
import { runWithTenant } from "../clients/tenant-context.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { formatError } from "./format-error.js";

export interface CreateXeroToolOptions {
  /**
   * Whether the tool acts on a Xero organisation. Tenanted tools get a
   * `tenantId` argument injected and are only run once that tenant has been
   * validated against the authorised connections. Defaults to true.
   */
  tenanted?: boolean;
}

const BEARER_TENANT_ID_DESCRIPTION =
  "The Xero tenant (organisation) ID this operation targets. Must be an authorised tenant ID; call the list-tenants tool to discover valid values.";

const CUSTOM_CONNECTION_TENANT_ID_DESCRIPTION =
  "The Xero tenant (organisation) ID this operation targets. This server uses a Custom Connection bound to a single organisation, so this can be omitted; when supplied it is validated against the bound organisation. Call the list-tenants tool to discover its ID.";

const tenantIdSchema = () =>
  isCustomConnectionMode()
    ? z.string().optional().describe(CUSTOM_CONNECTION_TENANT_ID_DESCRIPTION)
    : z.string().describe(BEARER_TENANT_ID_DESCRIPTION);

const tenantErrorResult = (error: unknown): CallToolResult => ({
  isError: true,
  content: [
    {
      type: "text" as const,
      // formatError is the redaction boundary: tenant errors raised by this
      // server pass through verbatim, while SDK failures are reduced to a safe
      // summary so tokens and request headers cannot escape.
      text: formatError(error),
    },
  ],
});

/**
 * Defines an MCP tool.
 *
 * Tenanted tools (the default) never choose an organisation for the caller:
 * the `tenantId` argument is injected here, resolved and validated before the
 * handler runs, and made available to handlers through the request-scoped
 * tenant context.
 */
export const CreateXeroTool =
  <Args extends ZodRawShapeCompat>(
    name: string,
    description: string,
    schema: Args,
    handler: ToolCallback<Args>,
    options: CreateXeroToolOptions = {},
  ): (() => ToolDefinition<ZodRawShapeCompat>) =>
  () => {
    if (options.tenanted === false) {
      return {
        name,
        description,
        schema,
        handler: handler as ToolCallback<ZodRawShapeCompat>,
      };
    }

    const invokeHandler = handler as unknown as (
      args: unknown,
      extra: unknown,
    ) => CallToolResult | Promise<CallToolResult>;

    const tenantedHandler: ToolCallback<ZodRawShapeCompat> = async (
      args,
      extra,
    ) => {
      const { tenantId, ...toolArgs } = (args ?? {}) as {
        tenantId?: unknown;
      } & Record<string, unknown>;

      let context;

      try {
        context = await resolveTenant(
          typeof tenantId === "string" ? tenantId : undefined,
        );
      } catch (error) {
        return tenantErrorResult(error);
      }

      return runWithTenant(context, () => invokeHandler(toolArgs, extra));
    };

    if ("tenantId" in schema) {
      // Guard against a tool silently losing its own tenantId argument, and
      // against one declaring a laxer tenantId than the injected field.
      throw new Error(
        `Tool "${name}" must not declare its own tenantId argument: tenanted tools get one injected.`,
      );
    }

    return {
      name,
      description,
      schema: { ...schema, tenantId: tenantIdSchema() },
      handler: tenantedHandler,
    };
  };
