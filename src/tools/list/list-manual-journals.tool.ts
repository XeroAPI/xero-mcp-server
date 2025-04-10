import { ManualJournal } from "xero-node";
import { listXeroManualJournals } from "../../handlers/list-xero-manual-journals.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { z } from "zod";

const ListManualJournalsTool = CreateXeroTool(
  "list-manual-journals",
  `List all manual journals from Xero.
Ask the user if they want to see a specific manual journal or all manual journals before running.
Can optionally pass in manual journal ID to retrieve a specific journal, or a date to filter journals modified after that date.
The response presents a complete overview of all manual journals currently registered in your Xero account, with their details. 
Ask the user if they want the next page of manual journals after running this tool if 10 manual journals are returned.
If they want the next page, call this tool again with the next page number, modified date, and the manual journal ID if one was provided in the previous call.`,
  {
    manualJournalId: z
      .string()
      .optional()
      .describe("Optional ID of the manual journal to retrieve"),
    modifiedAfter: z
      .string()
      .optional()
      .describe(
        "Optional date YYYY-MM-DD to filter journals modified after this date",
      ),
    page: z.number().optional().describe("Optional page number for pagination"),
    // TODO: where, order
  },
  async (args) => {
    const response = await listXeroManualJournals(
      args?.page,
      args?.manualJournalId,
      args?.modifiedAfter,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing manual journals: ${response.error}`,
          },
        ],
      };
    }

    const manualJournals = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${manualJournals?.length || 0} manual journals:`,
        },
        ...(manualJournals?.map((journal: ManualJournal) => ({
          type: "text" as const,
          text: [
            `Manual Journal ID: ${journal.manualJournalID}`,
            journal.narration
              ? `Description: ${journal.narration}`
              : "No description",
            journal.date ? `Date: ${journal.date}` : null,
            journal.journalLines
              ? journal.journalLines.map((line) => ({
                  type: "text" as const,
                  text: [
                    `Line Amount: ${line.lineAmount}`,
                    line.accountCode
                      ? `Account Code: ${line.accountCode}`
                      : "No account code",
                    line.description
                      ? `Description: ${line.description}`
                      : "No description",
                    line.taxType ? `Tax Type: ${line.taxType}` : "No tax type",
                    `Tax Amount: ${line.taxAmount}`,
                  ]
                    .filter(Boolean)
                    .join("\n"),
                }))
              : [{ type: "text" as const, text: "No journal lines" }],
            journal.lineAmountTypes
              ? `Line Amount Types: ${journal.lineAmountTypes}`
              : "No line amount types",
            journal.status ? `Status: ${journal.status}` : "No status",
            journal.url ? `URL: ${journal.url}` : "No URL",
            `Show on Cash Basis Reports: ${journal.showOnCashBasisReports}`,
            `Has Attachments: ${journal.hasAttachments}`,
            journal.updatedDateUTC
              ? `Last Updated: ${journal.updatedDateUTC.toLocaleDateString()}`
              : "No last updated date",
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListManualJournalsTool;
