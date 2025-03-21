import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoices } from "xero-node";

/**
 * List all invoices from Xero
 */
export async function listXeroInvoices(
  page: number = 1,
  contactIds?: string[],
): Promise<ToolResponse<Invoices>> {
  try {
    await xeroClient.authenticate();

    const { body: invoices } = await xeroClient.accountingApi.getInvoices(
      "", // tenantId (empty string for default)
      undefined, // ifModifiedSince
      undefined, // where
      undefined, // order
      undefined, // iDs
      undefined, // invoiceNumbers
      contactIds, // contactIDs
      undefined, // statuses
      page,
      false, // includeArchived
      false, // createdByMyApp
      undefined, // summaryOnly
      true, // includePayments
      10, // pageSize
      undefined, // unitdp
      undefined, // createdByMyApp
    );

    return {
      result: invoices,
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
