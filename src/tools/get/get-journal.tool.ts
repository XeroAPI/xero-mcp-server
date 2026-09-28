import { z } from "zod";
import { getXeroJournal } from "../../handlers/get-xero-journal.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatJournal } from "../../helpers/format-journal.js";

const GetJournalTool = CreateXeroTool(
  "get-journal",
  `Retrieve a single general ledger journal from Xero by ID or journal number.
  Provide journalId or journalNumber. If both are provided, the ID is used.
  This is a posted ledger journal, not a manual journal document — use list-manual-journals for those.
  Requires the accounting.journals.read scope on granular-scope apps (or accounting.transactions on older apps).
  Positive line net amounts are debits; negative are credits.`,
  {
    journalId: z
      .string()
      .optional()
      .describe("The ID of the general ledger journal to retrieve."),
    journalNumber: z
      .number()
      .optional()
      .describe("The Xero journal number, used when the ID is not available."),
  },
  async ({ journalId, journalNumber }) => {
    const response = await getXeroJournal({ journalId, journalNumber });

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving journal: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatJournal(response.result),
        },
      ],
    };
  },
);

export default GetJournalTool;
