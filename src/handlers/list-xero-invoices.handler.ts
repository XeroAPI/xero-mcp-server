import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getInvoices(
  invoiceNumbers: string[] | undefined,
  contactIds: string[] | undefined,
  page: number,
): Promise<Invoice[]> {
  await xeroClient.authenticate();

  const invoices = await xeroClient.accountingApi.getInvoices(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    undefined, // where
    "UpdatedDateUTC DESC", // order
    undefined, // iDs
    invoiceNumbers, // invoiceNumbers
    contactIds, // contactIDs
    undefined, // statuses
    page,
    false, // includeArchived
    false, // createdByMyApp
    undefined, // unitdp
    false, // summaryOnly
    10, // pageSize
    undefined, // searchTerm
    getClientHeaders(),
  );
  return invoices.body.invoices ?? [];
}

/**
 * List all invoices from Xero
 */
export async function listXeroInvoices(
  page: number = 1,
  contactIds?: string[],
  invoiceNumbers?: string[],
): Promise<XeroClientResponse<Invoice[]>> {
  try {
    console.log(`[Xero API] Fetching invoices (page ${page})...`);
    const invoices = await getInvoices(invoiceNumbers, contactIds, page);
    console.log(`[Xero API] Successfully fetched ${invoices.length} invoices`);

    return {
      result: invoices,
      isError: false,
      error: null,
    };
  } catch (error) {
    console.error("[Xero API] ERROR: Failed to fetch invoices");
    console.error("[Xero API] Error details:", error);
    const formattedError = formatError(error);
    console.error("[Xero API] Formatted error:", formattedError);
    return {
      result: null,
      isError: true,
      error: formattedError,
    };
  }
}
