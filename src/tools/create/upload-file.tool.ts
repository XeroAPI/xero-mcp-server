import { z } from "zod";

import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { uploadXeroFile } from "../../handlers/xero-files.handler.js";

const UploadFileTool = CreateXeroTool(
  "upload-file",
  "Upload a file into Xero Files. If no folder ID is provided the file is uploaded to the Xero Files inbox.",
  {
    fileName: z
      .string()
      .describe("The filename to upload to Xero Files, for example receipt-2026-03.pdf."),
    fileContent: z
      .string()
      .describe("The base64-encoded file content. Data URLs are also accepted."),
    contentType: z
      .string()
      .describe("The MIME type of the file, for example application/pdf or image/png."),
    name: z
      .string()
      .optional()
      .describe(
        "Optional exact uploaded name for the file in Xero Files. Defaults to fileName and should include the extension.",
      ),
    folderId: z
      .string()
      .optional()
      .describe("Optional folder ID to upload into. If omitted, the file is uploaded to the Xero Files inbox."),
  },
  async ({ fileName, fileContent, contentType, name, folderId }) => {
    const response = await uploadXeroFile(
      fileName,
      fileContent,
      contentType,
      name,
      folderId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading file: ${response.error}`,
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
            "File uploaded successfully:",
            `File ID: ${file.id ?? "Unknown"}`,
            `Name: ${file.name ?? name ?? fileName}`,
            `Content Type: ${file.mimeType ?? contentType}`,
            file.size !== undefined ? `Size: ${file.size} bytes` : null,
            file.folderId ? `Folder ID: ${file.folderId}` : "Folder: Inbox",
            file.createdDateUtc ? `Created: ${file.createdDateUtc}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UploadFileTool;
