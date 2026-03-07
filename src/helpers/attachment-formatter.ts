import { Attachment } from "xero-node";

/**
 * Format a list of attachments into a human-readable string
 */
export function formatAttachmentList(
  attachments: Attachment[],
  options: { includeOnline?: boolean } = { includeOnline: true },
): string {
  return attachments
    .map((att, index) => {
      const sizeMB = att.contentLength
        ? (att.contentLength / (1024 * 1024)).toFixed(2)
        : "Unknown";

      const lines = [
        `${index + 1}. ${att.fileName}`,
        `   Attachment ID: ${att.attachmentID}`,
        `   MIME Type: ${att.mimeType}`,
        `   Size: ${sizeMB} MB`,
      ];

      if (options.includeOnline) {
        lines.push(`   Include Online: ${att.includeOnline ? "Yes" : "No"}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Format attachment details for successful operations
 */
export function formatAttachmentDetails(attachment: Attachment): string {
  const lines = [
    `File Name: ${attachment.fileName}`,
    `Attachment ID: ${attachment.attachmentID}`,
    `MIME Type: ${attachment.mimeType}`,
  ];

  if (attachment.includeOnline !== undefined) {
    lines.push(`Include Online: ${attachment.includeOnline ? "Yes" : "No"}`);
  }

  return lines.join("\n");
}

/**
 * Format file content details for downloaded attachments
 */
export function formatDownloadedAttachment(
  fileName: string,
  mimeType: string,
  contentBase64: string,
): string {
  const sizeKB = Math.round((contentBase64.length * 0.75) / 1024);

  return [
    "Successfully retrieved attachment:",
    `File Name: ${fileName}`,
    `MIME Type: ${mimeType}`,
    `Content Size: ${sizeKB} KB (approx)`,
    "",
    "The file content is provided as base64-encoded data below.",
    "You can decode this content to access the file data.",
  ].join("\n");
}
