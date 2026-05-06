import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { ToolFactory } from "../tools/tool-factory.js";

const xeroMcpInstructions = [
  "File uploads must use the staged upload flow.",
  "First call prepare-file-upload, then Cowork uploads the selected local file to the returned uploadUrl using multipart form data, then call add-attachment or upload-file with stagedFileId.",
  "Never send base64 file content or arbitrary local file paths for uploads; the public upload tools only accept stagedFileId.",
  "If an upload tool returns STAGED_UPLOAD_NOT_FOUND_ON_THIS_INSTANCE with retryable=true, retry the same Xero upload tool call up to 3 times. This usually means the file was uploaded to a different ephemeral backend instance. If retries fail, prepare a new upload session and have Cowork re-upload the file.",
].join("\n");

export function createXeroMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "Xero MCP Server",
      version: getPackageVersion(),
    },
    {
      instructions: xeroMcpInstructions,
    },
  );

  ToolFactory(server);

  return server;
}
