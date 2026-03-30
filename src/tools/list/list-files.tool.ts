import { z } from "zod";

import { listXeroFiles } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const fileSortFields = ["Name", "Size", "CreatedDateUTC"] as const;
const sortDirections = ["ASC", "DESC"] as const;

const ListFilesTool = CreateXeroTool(
  "list-files",
  "List files from Xero Files. Optionally filter the results to a specific folder ID.",
  {
    pageSize: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Optional number of files to request from Xero."),
    page: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Optional pagination value passed directly to the Xero Files API."),
    sort: z
      .enum(fileSortFields)
      .optional()
      .describe("Optional sort field."),
    direction: z
      .enum(sortDirections)
      .optional()
      .describe("Optional sort direction."),
    folderId: z
      .string()
      .optional()
      .describe("Optional folder ID to filter the returned files by."),
  },
  async ({ pageSize, page, sort, direction, folderId }) => {
    const response = await listXeroFiles(
      pageSize,
      page,
      sort,
      direction,
      folderId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing files: ${response.error}`,
          },
        ],
      };
    }

    const result = response.result;
    const files = result.files;

    if (files.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: folderId
              ? `No files found for folder ${folderId}.`
              : "No files found in Xero Files.",
          },
        ],
      };
    }

    const summary =
      folderId && result.totalCount !== undefined
        ? `Showing ${files.length} file${files.length === 1 ? "" : "s"} from folder ${folderId} (Xero returned ${result.totalCount} total file${result.totalCount === 1 ? "" : "s"} for this request).`
        : `Found ${files.length} file${files.length === 1 ? "" : "s"}${result.totalCount !== undefined ? ` (Xero totalCount: ${result.totalCount})` : ""}.`;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            summary,
            result.page !== undefined ? `Page: ${result.page}` : null,
            result.perPage !== undefined ? `Per Page: ${result.perPage}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
        ...files.map((file) => ({
          type: "text" as const,
          text: [
            `File ID: ${file.id ?? "Unknown"}`,
            `Name: ${file.name ?? "Unknown"}`,
            file.mimeType ? `Content Type: ${file.mimeType}` : null,
            file.size !== undefined ? `Size: ${file.size} bytes` : null,
            file.folderId ? `Folder ID: ${file.folderId}` : "Folder ID: Not returned by Xero",
            file.createdDateUtc ? `Created: ${file.createdDateUtc}` : null,
            file.updatedDateUtc ? `Updated: ${file.updatedDateUtc}` : null,
            file.user?.fullName
              ? `Created By: ${file.user.fullName}`
              : file.user?.name
                ? `Created By: ${file.user.name}`
                : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      ],
    };
  },
);

export default ListFilesTool;
