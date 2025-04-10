import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { LineAmountTypes, ManualJournal } from "xero-node";
import { updateXeroManualJournal } from "../../handlers/update-xero-manual-journal.handler.js";

const UpdateManualJournalTool = CreateXeroTool(
  "update-manual-journal",
  "Update a manual journal in Xero. Only works on draft manual journals.\
  Do not modify line items or parameters that have not been specified by the user.",
  {
    narration: z
      .string()
      .describe("Description of manual journal being posted"),
    manualJournalID: z.string().describe("ID of the manual journal to update"),
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
      const response = await updateXeroManualJournal(
        args.narration,
        args.manualJournalID,
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
              text: `Error updating manual journal: ${response.error}`,
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
              `Manual journal updated: ${manualJournal.narration} (ID: ${manualJournal.manualJournalID})`,
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
            text: `Error updating manual journal: ${err.message}`,
          },
        ],
      };
    }
  },
);

export default UpdateManualJournalTool;
