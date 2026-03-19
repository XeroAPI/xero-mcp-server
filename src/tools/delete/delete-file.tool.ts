import { z } from "zod";

import { deleteXeroFile } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeleteFileTool = CreateXeroTool(
  "delete-file",
  "Delete a document from Xero Files permanently.",
  {
    fileId: z
      .string()
      .describe("The Xero Files file ID to delete."),
  },
  async ({ fileId }) => {
    const response = await deleteXeroFile(fileId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting file: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully deleted file with ID: ${fileId}`,
        },
      ],
    };
  },
);

export default DeleteFileTool;
