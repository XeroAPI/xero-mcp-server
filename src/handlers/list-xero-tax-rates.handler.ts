import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { TaxRate } from "xero-node";

async function getTaxRates(): Promise<TaxRate[]> {
  await xeroClient.authenticate();

  const taxRates = await xeroClient.accountingApi.getTaxRates(
    "", // tenantId (empty string for default)
    undefined, // where
    undefined, // order
    {
      headers: { "user-agent": `xero-mcp-server-${getPackageVersion()}` },
    },
  );
  return taxRates.body.taxRates ?? [];
}

/**
 * List all tax rates from Xero
 */
export async function listXeroTaxRates(): Promise<ToolResponse<TaxRate[]>> {
  try {
    const taxRates = await getTaxRates();

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
