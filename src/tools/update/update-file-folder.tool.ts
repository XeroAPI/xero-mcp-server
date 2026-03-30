import { z } from "zod";

import { updateXeroFileFolder } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const UpdateFileFolderTool = CreateXeroTool(
  "update-file-folder",
  "Rename an existing Xero Files folder. Rename only; the inbox folder cannot be renamed.",
  {
    folderId: z
      .string()
      .describe("The Xero Files folder ID to update."),
    name: z
      .string()
      .describe("The new folder name."),
  },
  async ({ folderId, name }) => {
    const response = await updateXeroFileFolder(folderId, name);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating file folder: ${response.error}`,
          },
        ],
      };
    }

    const folder = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "File folder updated successfully:",
            `Folder ID: ${folder.id ?? folderId}`,
            `Name: ${folder.name ?? name}`,
            folder.fileCount !== undefined
              ? `File Count: ${folder.fileCount}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdateFileFolderTool;
