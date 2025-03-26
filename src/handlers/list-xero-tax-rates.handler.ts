import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { TaxRates } from "xero-node";

/**
 * List all tax rates from Xero
 */
export async function listXeroTaxRates(): Promise<ToolResponse<TaxRates>> {
  try {
    await xeroClient.authenticate();

    const { body: taxRates } = await xeroClient.accountingApi.getTaxRates(
      "", // tenantId (empty string for default)  
      undefined, // where
      undefined, // order
      {
        headers: { "user-agent": `xero-mcp-server-${getPackageVersion()}` },
      }, // options
    );

    return {
      result: taxRates,
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
