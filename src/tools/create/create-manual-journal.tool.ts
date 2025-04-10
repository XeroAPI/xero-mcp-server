import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroManualJournal } from "../../handlers/create-xero-manual-journal.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { LineAmountTypes, ManualJournal } from "xero-node";

const CreateManualJournalTool = CreateXeroTool(
  "create-manual-journal",
  "Create a manual journal in Xero.\
  Retrieve a list of account codes in Xero to use for the journal lines.\
  Journal lines must contain at least two individual journal lines with account codes, \
  use basic accounting account types pairing when not specified, \
  and make sure journal line pairs have credit and debit balanced.",
  {
    narration: z
      .string()
      .describe("Description of manual journal being posted"),
    manualJournalLines: z
      .array(
        z.object({
          lineAmount: z
            .number()
            .describe(
              "Total for manual journal line. Debits are positive, credits are negative value",
            ),
          accountCode: z.string().describe("Account code for the journal line"),
          description: z
            .string()
            .optional()
            .describe("Optional description for manual journal line"),
          taxType: z
            .string()
            .optional()
            .describe("Optional tax type for the manual journal line"),
          // TODO: TODO: tracking can be added here
        }),
      )
      .describe(
        "The manualJournalLines element must contain at least two individual manualJournalLine sub-elements",
      ),
    date: z.string().optional().describe("Optional date in YYYY-MM-DD format"),
    lineAmountTypes: z
      .enum(["EXCLUSIVE", "INCLUSIVE", "NO_TAX"])
      .optional()
      .describe(
        "Optional line amount types (EXCLUSIVE, INCLUSIVE, NO_TAX), NO_TAX by default",
      ),
    status: z
      .enum(["DRAFT", "POSTED", "DELETED", "VOID", "ARCHIVED"])
      .optional()
      .describe(
        "Optional status of the manual journal (DRAFT, POSTED, DELETED, VOID, ARCHIVED), DRAFT by default",
      ),
    url: z
      .string()
      .optional()
      .describe("Optional URL link to a source document"),
    showOnCashBasisReports: z
      .boolean()
      .optional()
      .describe(
        "Optional boolean to show on cash basis reports, default is true",
      ),
  },
  async (args) => {
    try {
      const response = await createXeroManualJournal(
        args.narration,
        args.manualJournalLines,
        args.date,
        args.lineAmountTypes as LineAmountTypes | undefined,
        args.status as ManualJournal.StatusEnum | undefined,
        args.url,
        args.showOnCashBasisReports,
      );

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating manual journal: ${response.error}`,
            },
          ],
        };
      }

      const manualJournal = response.result;
      const deepLink = manualJournal.manualJournalID
        ? await getDeepLink(
            DeepLinkType.MANUAL_JOURNAL,
            manualJournal.manualJournalID,
          )
        : null;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Manual journal created: ${manualJournal.narration} (ID: ${manualJournal.manualJournalID})`,
              manualJournal.date ? `Date: ${manualJournal.date}` : null,
              manualJournal.status
                ? `Status: ${manualJournal.status}`
                : "No status",
              manualJournal.journalLines
                ? manualJournal.journalLines.map((line) => ({
                    type: "text" as const,
                    text: [
                      `Line Amount: ${line.lineAmount}`,
                      line.accountCode
                        ? `Account Code: ${line.accountCode}`
                        : "No account code",
                      line.description
                        ? `Description: ${line.description}`
                        : "No description",
                      line.taxType
                        ? `Tax Type: ${line.taxType}`
                        : "No tax type",
                      `Tax Amount: ${line.taxAmount}`,
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  }))
                : [{ type: "text" as const, text: "No journal lines" }],
              `Show on Cash Basis Reports: ${manualJournal.showOnCashBasisReports}`,
              deepLink ? `Link to view: ${deepLink}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    } catch (error) {
      const err = ensureError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating manual journal: ${err.message}`,
          },
        ],
      };
    }
  },
);

export default CreateManualJournalTool;
