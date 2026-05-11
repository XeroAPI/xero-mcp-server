import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { TaxComponent, TaxRate } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function createTaxRate(
  name: string,
  taxComponents: TaxComponent[],
  reportTaxType?: TaxRate.ReportTaxTypeEnum,
): Promise<TaxRate | undefined> {
  await xeroClient.authenticate();

  const taxRate: TaxRate = {
    name,
    taxComponents,
    reportTaxType,
  };

  const response = await xeroClient.accountingApi.createTaxRates(
    xeroClient.tenantId,
    { taxRates: [taxRate] },
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.taxRates?.[0];
}

export async function createXeroTaxRate(
  name: string,
  taxComponents: TaxComponent[],
  reportTaxType?: TaxRate.ReportTaxTypeEnum,
): Promise<XeroClientResponse<TaxRate>> {
  try {
    const created = await createTaxRate(name, taxComponents, reportTaxType);

    if (!created) {
      throw new Error("Tax rate creation failed.");
    }

    return {
      result: created,
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
