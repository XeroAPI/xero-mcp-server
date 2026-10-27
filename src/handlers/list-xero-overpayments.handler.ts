import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Overpayment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getOverpayments(
  contactId: string | undefined,
  page: number,
  pageSize: number = 10,
): Promise<Overpayment[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getOverpayments(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    contactId ? `Contact.ContactID=guid("${contactId}")` : undefined, // where
    "UpdatedDateUTC DESC", // order
    page, // page
    undefined, // unitdp
    pageSize, // pageSize
    getClientHeaders(),
  );

  return response.body.overpayments ?? [];
}

/**
 * List overpayments from Xero
 */
export async function listXeroOverpayments(
  page: number = 1,
  contactId?: string,
  pageSize: number = 10,
): Promise<XeroClientResponse<Overpayment[]>> {
  try {
    const overpayments = await getOverpayments(contactId, page, pageSize);

    return {
      result: overpayments,
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
