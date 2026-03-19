import { z } from "zod";

import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { uploadXeroFile } from "../../handlers/xero-files.handler.js";

const UploadFileTool = CreateXeroTool(
  "upload-file",
  "Upload a base64-encoded file into Xero Files, which is Xero's standalone document store. Specify folderId for reliable folder placement and prefer creating a named folder such as Invoices and uploading directly to it. If no folder ID is provided, files may land in Archive rather than Inbox in the Xero UI. Direct uploads to the Inbox are not supported; Inbox placement may not behave as expected in demo companies. Use `add-attachment` instead to attach a file to a specific invoice, bill, contact, or other Xero object.",
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
      .describe(
        "Optional non-Inbox folder ID to upload into. Provide this for reliable folder placement, ideally for a named folder such as Invoices. If omitted, files may land in Archive rather than Inbox in the Xero UI.",
      ),
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
            folderId
              ? `Folder ID: ${file.folderId ?? folderId}`
              : "Destination: Xero default upload location (appears in Archive in the Xero UI)",
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
