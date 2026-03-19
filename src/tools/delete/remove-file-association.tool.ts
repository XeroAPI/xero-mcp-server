import { z } from "zod";

import { removeXeroFileAssociation } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const RemoveFileAssociationTool = CreateXeroTool(
  "remove-file-association",
  "Remove an association between a Xero Files document and a Xero object.",
  {
    fileId: z
      .string()
      .describe("The Xero Files file ID."),
    objectId: z
      .string()
      .describe("The Xero object ID currently associated with the file."),
  },
  async ({ fileId, objectId }) => {
    const response = await removeXeroFileAssociation(fileId, objectId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error removing file association: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully removed association between file ${fileId} and object ${objectId}`,
        },
      ],
    };
  },
);

export default RemoveFileAssociationTool;
