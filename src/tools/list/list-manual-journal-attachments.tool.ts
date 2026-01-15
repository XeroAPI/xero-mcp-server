import { z } from "zod";
import { listAttachments } from "../../handlers/list-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatAttachmentList } from "../../helpers/attachment-formatter.js";

const ListManualJournalAttachmentsTool = CreateXeroTool(
  "list-manual-journal-attachments",
  `List all file attachments on a manual journal in Xero.
  Returns metadata about each attachment including filename, attachment ID, MIME type, and size.
  Use the attachment ID with get-manual-journal-attachment to download file content.`,
  {
    manualJournalId: z.string().describe(
      "The ID of the manual journal to list attachments for. Can be obtained from create-manual-journal or list-manual-journals tools.",
    ),
  },
  async ({ manualJournalId }) => {
    const result = await listAttachments("manualJournal", manualJournalId);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing attachments: ${result.error}`,
          },
        ],
      };
    }

    const attachments = result.result;

    if (!attachments || attachments.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No attachments found on manual journal ${manualJournalId}.`,
          },
        ],
      };
    }

    const attachmentList = formatAttachmentList(attachments, {
      includeOnline: true,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Found ${attachments.length} attachment(s) on manual journal ${manualJournalId}:`,
            "",
            attachmentList,
          ].join("\n"),
        },
      ],
    };
  },
);

export default ListManualJournalAttachmentsTool;
