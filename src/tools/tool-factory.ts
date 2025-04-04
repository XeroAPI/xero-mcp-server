import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateTools } from "./create/index.js";
import { ListTools } from "./list/index.js";
import { UpdateTools } from "./update/index.js";

export function ToolFactory(server: McpServer) {
  CreateTools.forEach((tool) =>
    server.tool(tool.name, tool.description, tool.schema, tool.handler),
  );
  ListTools.forEach((tool) =>
    server.tool(tool.name, tool.description, tool.schema, tool.handler),
  );
  UpdateTools.forEach((tool) =>
    server.tool(tool.name, tool.description, tool.schema, tool.handler),
  );
}
