import { z } from "zod";

import { getXeroAttachmentDocument } from "../../handlers/xero-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { xeroAttachmentObjectTypes } from "../../types/xero-attachment-object-type.js";

const GetAttachmentTool = CreateXeroTool(
  "get-attachment",
  "Retrieve the binary content of an accounting attachment from Xero and return it as base64. Provide either an attachment ID or filename.",
  {
    objectType: z
      .enum(xeroAttachmentObjectTypes)
      .describe("The type of Xero object the attachment belongs to."),
    objectId: z
      .string()
      .describe("The Xero object ID that owns the attachment."),
    attachmentId: z
      .string()
      .optional()
      .describe("Optional attachment ID returned by list-attachments."),
    fileName: z
      .string()
      .optional()
      .describe("Optional attachment filename. Use this if you do not have the attachment ID."),
    contentType: z
      .string()
      .optional()
      .describe("Optional MIME type override if Xero does not return one in attachment metadata."),
  },
  async ({ objectType, objectId, attachmentId, fileName, contentType }) => {
    if (!attachmentId && !fileName) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error retrieving attachment: either attachmentId or fileName is required.",
          },
        ],
      };
    }

    const response = await getXeroAttachmentDocument(
      objectType,
      objectId,
      attachmentId,
      fileName,
      contentType,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving attachment: ${response.error}`,
          },
        ],
      };
    }

    const document = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Attachment retrieved successfully:",
            `Object Type: ${objectType}`,
            `Object ID: ${objectId}`,
            `Attachment ID: ${document.attachmentId ?? "Unknown"}`,
            `File: ${document.fileName ?? fileName ?? "Unknown"}`,
            `Content Type: ${document.contentType}`,
            document.contentLength !== undefined
              ? `Size: ${document.contentLength} bytes`
              : null,
            document.includeOnline !== undefined
              ? `Include Online: ${document.includeOnline ? "Yes" : "No"}`
              : null,
            document.url ? `URL: ${document.url}` : null,
            document.contentText ? `Decoded Text:\n${document.contentText}` : null,
            `Content Base64:\n${document.contentBase64}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetAttachmentTool;
