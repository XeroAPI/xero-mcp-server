import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";

import {
  getConfiguredScopes,
  isCustomConnectionsAuthMode,
  scopesSatisfyTool,
} from "../helpers/scopes.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { CreateTools } from "./create/index.js";
import { DeleteTools } from "./delete/index.js";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";
import { UpdateTools } from "./update/index.js";

const SCOPE_FILTER_LOG_ENV = "XERO_MCP_LOG_SCOPE_FILTERING";

function registerTools(
  server: McpServer,
  factories: Array<() => ToolDefinition<ZodRawShapeCompat>>,
  configuredScopes: Set<string>,
  filterByScopes: boolean,
): { registered: number; skipped: number } {
  let registered = 0;
  let skipped = 0;
  for (const factory of factories) {
    const tool = factory();
    if (filterByScopes && !scopesSatisfyTool(configuredScopes, tool.requiredScopes)) {
      skipped++;
      continue;
    }
    server.tool(tool.name, tool.description, tool.schema, tool.handler);
    registered++;
  }
  return { registered, skipped };
}

export function ToolFactory(server: McpServer) {
  const filterByScopes = isCustomConnectionsAuthMode();
  const configuredScopes = filterByScopes ? getConfiguredScopes() : new Set<string>();

  let totalRegistered = 0;
  let totalSkipped = 0;
  for (const list of [
    DeleteTools,
    GetTools,
    CreateTools,
    ListTools,
    UpdateTools,
  ]) {
    const { registered, skipped } = registerTools(
      server,
      list,
      configuredScopes,
      filterByScopes,
    );
    totalRegistered += registered;
    totalSkipped += skipped;
  }

  if (
    filterByScopes &&
    totalSkipped > 0 &&
    process.env[SCOPE_FILTER_LOG_ENV]?.trim()
  ) {
    console.error(
      `[xero-mcp-server] OAuth scope filtering: registered ${totalRegistered} tool(s), omitted ${totalSkipped}. Unset ${SCOPE_FILTER_LOG_ENV} to hide this message.`,
    );
  }
}
