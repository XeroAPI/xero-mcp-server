import { Journal } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface GetJournalParams {
  journalId?: string;
  journalNumber?: number;
}

async function fetchJournal(
  params: GetJournalParams,
): Promise<Journal | undefined> {
  await xeroClient.authenticate();

  if (params.journalId) {
    const response = await xeroClient.accountingApi.getJournal(
      xeroClient.tenantId,
      params.journalId,
      getClientHeaders(),
    );
    return response.body.journals?.[0];
  }

  if (params.journalNumber != null) {
    const response = await xeroClient.accountingApi.getJournalByNumber(
      xeroClient.tenantId,
      params.journalNumber,
      getClientHeaders(),
    );
    return response.body.journals?.[0];
  }

  return undefined;
}

/**
 * Retrieve a single general ledger journal from Xero.
 */
export async function getXeroJournal(
  params: GetJournalParams,
): Promise<XeroClientResponse<Journal>> {
  try {
    if (!params.journalId && params.journalNumber == null) {
      return {
        result: null,
        isError: true,
        error: "Provide a journalId or journalNumber.",
      };
    }

    const journal = await fetchJournal(params);

    if (!journal) {
      return {
        result: null,
        isError: true,
        error: "Journal not found.",
      };
    }

    return {
      result: journal,
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
