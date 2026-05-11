import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CreateTools } from "./create/index.js";
import { DeleteTools } from "./delete/index.js";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";
import { UpdateTools } from "./update/index.js";
import {
  requireWriteConfirmation,
  type WriteAction,
} from "../helpers/require-write-confirmation.js";

function inferUpdateAction(name: string): WriteAction {
  if (name.startsWith("approve-")) return "approve";
  if (name.startsWith("revert-")) return "revert";
  return "update";
}

export function ToolFactory(server: McpServer) {

  DeleteTools.map((tool) => tool())
    .map((tool) => requireWriteConfirmation("delete", tool))
    .forEach((tool) =>
      server.tool(tool.name, tool.description, tool.schema, tool.handler),
    );
  GetTools.map((tool) => tool())
    .forEach((tool) =>
      server.tool(tool.name, tool.description, tool.schema, tool.handler),
    );
  CreateTools.map((tool) => tool())
    .map((tool) => requireWriteConfirmation("create", tool))
    .forEach((tool) =>
      server.tool(tool.name, tool.description, tool.schema, tool.handler),
    );
  ListTools.map((tool) => tool())
    .forEach((tool) =>
      server.tool(tool.name, tool.description, tool.schema, tool.handler),
    );
  UpdateTools.map((tool) => tool())
    .map((tool) => requireWriteConfirmation(inferUpdateAction(tool.name), tool))
    .forEach((tool) =>
      server.tool(tool.name, tool.description, tool.schema, tool.handler),
    );
}
