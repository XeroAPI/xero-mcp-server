import { z } from "zod";

import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { uploadXeroFile } from "../../handlers/xero-files.handler.js";

const UploadFileTool = CreateXeroTool(
  "upload-file",
  "Upload a previously staged file into Xero Files, which is Xero's standalone document store. First call `prepare-file-upload`, then Cowork uploads the selected file to the returned uploadUrl, then call this tool with stagedFileId. Do not send base64 file content or local file paths. Specify folderId for reliable folder placement and prefer creating a named folder such as Invoices and uploading directly to it. If no folder ID is provided, files may land in Archive rather than Inbox in the Xero UI. Direct uploads to the Inbox are not supported; Inbox placement may not behave as expected in demo companies. Use `add-attachment` instead to attach a file to a specific invoice, bill, contact, or other Xero object.",
  {
    fileName: z
      .string()
      .describe(
        "The filename to upload to Xero Files, for example receipt-2026-03.pdf.",
      ),
    stagedFileId: z
      .string()
      .describe(
        "The staged upload ID returned by prepare-file-upload after Cowork has uploaded the file bytes to uploadUrl.",
      ),
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
  async ({ fileName, stagedFileId, name, folderId }) => {
    const response = await uploadXeroFile(
      fileName,
      stagedFileId,
      name,
      folderId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading file:\n${response.error}`,
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
            `Content Type: ${file.mimeType ?? "Unknown"}`,
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
