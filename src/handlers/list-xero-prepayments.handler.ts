import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Prepayment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getPrepayments(
  contactId: string | undefined,
  page: number,
  pageSize: number = 10,
): Promise<Prepayment[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getPrepayments(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    contactId ? `Contact.ContactID=guid("${contactId}")` : undefined, // where
    "UpdatedDateUTC DESC", // order
    page, // page
    undefined, // unitdp
    pageSize, // pageSize
    getClientHeaders(),
  );

  return response.body.prepayments ?? [];
}

/**
 * List prepayments from Xero
 */
export async function listXeroPrepayments(
  page: number = 1,
  contactId?: string,
  pageSize: number = 10,
): Promise<XeroClientResponse<Prepayment[]>> {
  try {
    const prepayments = await getPrepayments(contactId, page, pageSize);

    return {
      result: prepayments,
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
