import { z } from "zod";
import { getAttachment } from "../../handlers/get-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatDownloadedAttachment } from "../../helpers/attachment-formatter.js";

const GetManualJournalAttachmentTool = CreateXeroTool(
  "get-manual-journal-attachment",
  `Download a file attachment from a manual journal in Xero.
  Returns the file content as base64-encoded data along with filename and MIME type.
  Use list-manual-journal-attachments first to get the attachment ID.
  The agent can then process the base64 content (e.g., read PDF text, analyze images).`,
  {
    manualJournalId: z.string().describe(
      "The ID of the manual journal containing the attachment. Can be obtained from create-manual-journal or list-manual-journals tools.",
    ),
    attachmentId: z.string().describe(
      "The ID of the attachment to download. Can be obtained from list-manual-journal-attachments tool.",
    ),
  },
  async ({ manualJournalId, attachmentId }) => {
    const result = await getAttachment(
      "manualJournal",
      manualJournalId,
      attachmentId,
    );

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting attachment: ${result.error}`,
          },
        ],
      };
    }

    const attachment = result.result;

    if (!attachment) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Attachment ${attachmentId} not found.`,
          },
        ],
      };
    }

    const formattedDetails = formatDownloadedAttachment(
      attachment.fileName,
      attachment.mimeType,
      attachment.contentBase64,
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formattedDetails,
        },
        {
          type: "text" as const,
          text: attachment.contentBase64,
        },
      ],
    };
  },
);

export default GetManualJournalAttachmentTool;
