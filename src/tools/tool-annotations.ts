import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export type ToolOperation = "create" | "delete" | "get" | "list" | "update";

export function annotationsForOperation(
  operation: ToolOperation,
): ToolAnnotations {
  if (operation === "get" || operation === "list") {
    return {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    };
  }

  return {
    readOnlyHint: false,
    destructiveHint: operation !== "create",
    idempotentHint: false,
    openWorldHint: true,
  };
}
