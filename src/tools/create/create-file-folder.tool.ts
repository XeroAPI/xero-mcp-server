import { z } from "zod";

import { createXeroFileFolder } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreateFileFolderTool = CreateXeroTool(
  "create-file-folder",
  "Create a custom folder in Xero Files.",
  {
    name: z
      .string()
      .describe("The folder name to create in Xero Files."),
  },
  async ({ name }) => {
    const response = await createXeroFileFolder(name);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating file folder: ${response.error}`,
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
            "File folder created successfully:",
            `Folder ID: ${folder.id ?? "Unknown"}`,
            `Name: ${folder.name ?? name}`,
            folder.fileCount !== undefined
              ? `File Count: ${folder.fileCount}`
              : null,
            folder.isInbox ? "Inbox: Yes" : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateFileFolderTool;
