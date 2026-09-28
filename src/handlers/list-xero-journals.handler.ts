import { Journal } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface ListJournalsParams {
  offset?: number;
  paymentsOnly?: boolean;
  ifModifiedSince?: string;
}

function parseIfModifiedSince(
  value: string | undefined,
): Date | undefined | "invalid" {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "invalid";
  }
  return parsed;
}

async function getJournals(
  params: ListJournalsParams,
): Promise<Journal[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getJournals(
    xeroClient.tenantId,
    parseIfModifiedSince(params.ifModifiedSince) as Date | undefined,
    params.offset,
    params.paymentsOnly,
    getClientHeaders(),
  );

  return response.body.journals ?? [];
}

/**
 * List general ledger journals from Xero (GET /Journals).
 * This is not the Manual Journals endpoint.
 */
export async function listXeroJournals(
  params: ListJournalsParams = {},
): Promise<XeroClientResponse<Journal[]>> {
  try {
    if (parseIfModifiedSince(params.ifModifiedSince) === "invalid") {
      return {
        result: null,
        isError: true,
        error: "ifModifiedSince must be a valid date.",
      };
    }

    const journals = await getJournals(params);

    return {
      result: journals,
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
