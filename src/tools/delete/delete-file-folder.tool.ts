import { z } from "zod";

import { deleteXeroFileFolder } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeleteFileFolderTool = CreateXeroTool(
  "delete-file-folder",
  "Delete a Xero Files folder. The inbox folder cannot be deleted.",
  {
    folderId: z
      .string()
      .describe("The Xero Files folder ID to delete."),
  },
  async ({ folderId }) => {
    const response = await deleteXeroFileFolder(folderId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting file folder: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully deleted file folder with ID: ${folderId}`,
        },
      ],
    };
  },
);

export default DeleteFileFolderTool;
