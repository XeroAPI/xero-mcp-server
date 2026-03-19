import { z } from "zod";

import { listXeroFileFolders } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const fileSortFields = ["Name", "Size", "CreatedDateUTC"] as const;

const ListFileFoldersTool = CreateXeroTool(
  "list-file-folders",
  "List folders available in Xero Files, including the inbox folder details when available.",
  {
    sort: z
      .enum(fileSortFields)
      .optional()
      .describe("Optional sort field."),
  },
  async ({ sort }) => {
    const response = await listXeroFileFolders(sort);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing file folders: ${response.error}`,
          },
        ],
      };
    }

    const folders = response.result;

    if (folders.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No Xero Files folders were returned.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${folders.length} file folder${folders.length === 1 ? "" : "s"}:`,
        },
        ...folders.map((folder) => ({
          type: "text" as const,
          text: [
            `Folder ID: ${folder.id ?? "Unknown"}`,
            `Name: ${folder.name ?? "Unnamed"}`,
            folder.fileCount !== undefined
              ? `File Count: ${folder.fileCount}`
              : null,
            folder.isInbox ? "Inbox: Yes" : null,
            folder.email ? `Inbox Email: ${folder.email}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      ],
    };
  },
);

export default ListFileFoldersTool;
