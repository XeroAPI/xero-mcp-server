import { z } from "zod";
import { listXeroJournals } from "../../handlers/list-xero-journals.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatJournal } from "../../helpers/format-journal.js";

const ListJournalsTool = CreateXeroTool(
  "list-journals",
  `List general ledger journals from Xero (GET /Journals).
  These are the posted double-entry journals created by invoices, payments, manual journals, and other source transactions.
  This is not list-manual-journals — use that tool for user-created draft/posted manual journals.
  Xero returns journals in journal-number order, typically 100 at a time.
  If 100 journals are returned, call this tool again with offset set to the last Journal Number.
  Requires the accounting.journals.read scope on granular-scope apps (or accounting.transactions on older apps).
  This endpoint can be premium-gated by Xero. Positive line net amounts are debits; negative are credits.`,
  {
    offset: z
      .number()
      .optional()
      .describe(
        "Return journals with a Journal Number greater than this value. Use the last Journal Number from the previous page.",
      ),
    ifModifiedSince: z
      .string()
      .optional()
      .describe(
        "Only return journals created or modified after this timestamp (ISO 8601 or YYYY-MM-DD).",
      ),
    paymentsOnly: z
      .boolean()
      .optional()
      .describe(
        "If true, return cash-basis payment journals only. Defaults to accrual journals.",
      ),
  },
  async ({ offset, ifModifiedSince, paymentsOnly }) => {
    const response = await listXeroJournals({
      offset,
      ifModifiedSince,
      paymentsOnly,
    });

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing journals: ${response.error}`,
          },
        ],
      };
    }

    const journals = response.result;
    const lastJournalNumber = journals?.at(-1)?.journalNumber;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${journals?.length || 0} journals:${
            journals?.length === 100 && lastJournalNumber != null
              ? ` Xero may have more. Call list-journals again with offset ${lastJournalNumber}.`
              : ""
          }`,
        },
        ...(journals?.map((journal) => ({
          type: "text" as const,
          text: formatJournal(journal),
        })) || []),
      ],
    };
  },
);

export default ListJournalsTool;
