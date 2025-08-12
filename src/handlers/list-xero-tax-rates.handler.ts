import { createXeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { TaxRate } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getTaxRates(bearerToken: string): Promise<TaxRate[]> {
  const xeroClient = createXeroClient(bearerToken);
  await xeroClient.authenticate();

  const taxRates = await xeroClient.accountingApi.getTaxRates(
    xeroClient.tenantId,
    undefined, // where
    undefined, // order
    getClientHeaders(),
  );
  return taxRates.body.taxRates ?? [];
}

/**
 * List all tax rates from Xero
 */
export async function listXeroTaxRates(bearerToken: string): Promise<
  XeroClientResponse<TaxRate[]>
> {
  try {
    const taxRates = await getTaxRates(bearerToken);

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
