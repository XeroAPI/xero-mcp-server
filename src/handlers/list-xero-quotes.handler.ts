import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { Quotes } from "xero-node";

/**
 * List all quotes from Xero
 */
export async function listXeroQuotes(
  page: number = 1,
  contactId?: string,
): Promise<ToolResponse<Quotes>> {
  try {
    await xeroClient.authenticate();

    const { body: quotes } = await xeroClient.accountingApi.getQuotes(
      "", // tenantId (empty string for default)
      undefined, // ifModifiedSince
      undefined, // dateFrom
      undefined, // dateTo
      undefined, // expiryDateFrom
      undefined, // expiryDateTo
      contactId, // contactID
      undefined, // status
      page,
      undefined, // order
      undefined, // quoteNumber
      {
        headers: { "user-agent": `xero-mcp-server-${getPackageVersion()}` },
      }, // options
    );

    return {
      result: quotes,
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
