import { z } from "zod";

import { getXeroFileDocumentById } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const GetFileTool = CreateXeroTool(
  "get-file",
  "Retrieve the binary content of a Xero Files document and return it as base64.",
  {
    fileId: z
      .string()
      .describe("The Xero Files file ID to retrieve."),
  },
  async ({ fileId }) => {
    const response = await getXeroFileDocumentById(fileId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving file: ${response.error}`,
          },
        ],
      };
    }

    const document = response.result;
    const file = document.file;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "File retrieved successfully:",
            `File ID: ${file.id ?? fileId}`,
            `Name: ${file.name ?? "Unknown"}`,
            file.mimeType ? `Content Type: ${file.mimeType}` : null,
            file.size !== undefined ? `Size: ${file.size} bytes` : null,
            file.folderId ? `Folder ID: ${file.folderId}` : "Folder: Inbox",
            file.createdDateUtc ? `Created: ${file.createdDateUtc}` : null,
            file.updatedDateUtc ? `Updated: ${file.updatedDateUtc}` : null,
            file.user?.fullName
              ? `Created By: ${file.user.fullName}`
              : file.user?.name
                ? `Created By: ${file.user.name}`
                : null,
            document.contentText ? `Decoded Text:\n${document.contentText}` : null,
            `Content Base64:\n${document.contentBase64}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetFileTool;
