import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CreateTools } from "./create/index.js";
import { DeleteTools } from "./delete/index.js";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";
import { UpdateTools } from "./update/index.js";
import { annotationsForOperation } from "./tool-annotations.js";

export function ToolFactory(server: McpServer) {
  DeleteTools.map((tool) => tool()).forEach((tool) =>
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      annotationsForOperation("delete"),
      tool.handler,
    ),
  );
  GetTools.map((tool) => tool()).forEach((tool) =>
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      annotationsForOperation("get"),
      tool.handler,
    ),
  );
  CreateTools.map((tool) => tool()).forEach((tool) =>
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      annotationsForOperation("create"),
      tool.handler,
    ),
  );
  ListTools.map((tool) => tool()).forEach((tool) =>
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      annotationsForOperation("list"),
      tool.handler,
    ),
  );
  UpdateTools.map((tool) => tool()).forEach((tool) =>
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      annotationsForOperation("update"),
      tool.handler,
    ),
  );
}
