import {
  LineAmountTypes,
  ManualJournal,
  ManualJournalLine,
  ManualJournals,
} from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

async function updateManualJournal(
  narration: string,
  manualJournalID: string,
  manualJournalLines: ManualJournalLine[],
  date?: string,
  lineAmountTypes?: LineAmountTypes,
  status?: ManualJournal.StatusEnum,
  url?: string,
  showOnCashBasisReports?: boolean,
): Promise<ManualJournal | undefined> {
  await xeroClient.authenticate();

  const manualJournal: ManualJournal = {
    narration,
    journalLines: manualJournalLines.map((journalLine) => ({
      lineAmount: journalLine.lineAmount,
      accountCode: journalLine.accountCode,
      description: journalLine.description, // Optional: description for the manual journal line
      taxType: journalLine.taxType, // Optional: tax type for the manual journal line
      // TODO: tracking can be added here
    })),
    date: date, // Optional: YYYY-MM-DD format
    lineAmountTypes: lineAmountTypes, // Optional: ManualJournal.LineAmountTypesEnum.EXCLUSIVE
    status: status, // Optional: ManualJournal.StatusEnum.DRAFT
    url: url, // Optional: URL link to a source document
    showOnCashBasisReports: showOnCashBasisReports, // Optional: default is true if not specified
  };

  const manualJournals: ManualJournals = {
    manualJournals: [manualJournal],
  };

  const response = await xeroClient.accountingApi.updateManualJournal(
    xeroClient.tenantId,
    manualJournalID,
    manualJournals,
    undefined,
    getClientHeaders(),
  );

  return response.body.manualJournals?.[0];
}

export async function updateXeroManualJournal(
  narration: string,
  manualJournalID: string,
  manualJournalLines: ManualJournalLine[],
  date?: string,
  lineAmountTypes?: LineAmountTypes,
  status?: ManualJournal.StatusEnum,
  url?: string,
  showOnCashBasisReports?: boolean,
): Promise<XeroClientResponse<ManualJournal>> {
  try {
    const updatedManualJournal = await updateManualJournal(
      narration,
      manualJournalID,
      manualJournalLines,
      date,
      lineAmountTypes,
      status,
      url,
      showOnCashBasisReports,
    );

    if (!updatedManualJournal) {
      throw new Error("Manual journal update failed.");
    }

    return {
      result: updatedManualJournal,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
