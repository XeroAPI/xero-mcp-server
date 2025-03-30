import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { Invoice } from "xero-node";

async function newFunction(
  invoiceNumbers: string[] | undefined,
  contactIds: string[] | undefined,
  page: number,
): Promise<Invoice[]> {
  await xeroClient.authenticate();

  const invoices = await xeroClient.accountingApi.getInvoices(
    "", // tenantId (empty string for default)
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
    true, // summaryOnly
    10, // pageSize
    undefined, // searchTerm
    {
      headers: {
        "user-agent": `xero-mcp-server-${getPackageVersion()}`,
      },
    },
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
): Promise<ToolResponse<Invoice[]>> {
  try {
    const invoices = await newFunction(invoiceNumbers, contactIds, page);

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
