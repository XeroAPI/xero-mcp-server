import { z } from "zod";

import { updateXeroFile } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const UpdateFileTool = CreateXeroTool(
  "update-file",
  "Update a Xero Files document. Use name to rename it and folderId to move it to another folder.",
  {
    fileId: z
      .string()
      .describe("The Xero Files file ID to update."),
    name: z
      .string()
      .optional()
      .describe("Optional new file name used to rename the file."),
    folderId: z
      .string()
      .optional()
      .describe("Optional folder ID to move the file into."),
  },
  async ({ fileId, name, folderId }) => {
    if (!name && !folderId) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error updating file: at least one of name or folderId is required.",
          },
        ],
      };
    }

    const response = await updateXeroFile(fileId, name, folderId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating file: ${response.error}`,
          },
        ],
      };
    }

    const file = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "File updated successfully:",
            `File ID: ${file.id ?? fileId}`,
            `Name: ${file.name ?? name ?? "Unknown"}`,
            file.folderId ? `Folder ID: ${file.folderId}` : null,
            file.updatedDateUtc ? `Updated: ${file.updatedDateUtc}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdateFileTool;
