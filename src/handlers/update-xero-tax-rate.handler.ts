import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { TaxComponent, TaxRate } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

type TaxRateStatusInput = "ACTIVE" | "DELETED" | "ARCHIVED";

async function findTaxRate(
  name: string | undefined,
  taxType: string | undefined,
): Promise<TaxRate | undefined> {
  const response = await xeroClient.accountingApi.getTaxRates(
    xeroClient.tenantId,
    undefined, // where
    undefined, // order
    getClientHeaders(),
  );

  const taxRates = response.body.taxRates ?? [];

  if (taxType) {
    const byType = taxRates.find(
      (t) => t.taxType?.toUpperCase() === taxType.toUpperCase(),
    );
    if (byType) return byType;
  }

  if (name) {
    return taxRates.find(
      (t) => t.name?.toLowerCase() === name.toLowerCase(),
    );
  }

  return undefined;
}

async function updateTaxRate(
  existing: TaxRate,
  newName: string | undefined,
  status: TaxRateStatusInput | undefined,
  taxComponents: TaxComponent[] | undefined,
  reportTaxType: TaxRate.ReportTaxTypeEnum | undefined,
): Promise<TaxRate | undefined> {
  await xeroClient.authenticate();

  const taxRate: TaxRate = {
    name: newName ?? existing.name,
    taxType: existing.taxType,
    taxComponents: taxComponents ?? existing.taxComponents,
    status: status ? TaxRate.StatusEnum[status] : existing.status,
    reportTaxType: reportTaxType ?? existing.reportTaxType,
  };

  const response = await xeroClient.accountingApi.updateTaxRate(
    xeroClient.tenantId,
    { taxRates: [taxRate] },
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.taxRates?.[0];
}

export async function updateXeroTaxRate(
  identifier: { name?: string; taxType?: string },
  newName?: string,
  status?: TaxRateStatusInput,
  taxComponents?: TaxComponent[],
  reportTaxType?: TaxRate.ReportTaxTypeEnum,
): Promise<XeroClientResponse<TaxRate>> {
  try {
    if (!identifier.name && !identifier.taxType) {
      throw new Error("Provide either name or taxType to identify the tax rate.");
    }

    const existing = await findTaxRate(identifier.name, identifier.taxType);

    if (!existing) {
      throw new Error(
        `Tax rate not found for ${identifier.taxType ? `taxType "${identifier.taxType}"` : `name "${identifier.name}"`}.`,
      );
    }

    const updated = await updateTaxRate(
      existing,
      newName,
      status,
      taxComponents,
      reportTaxType,
    );

    if (!updated) {
      throw new Error("Tax rate update failed.");
    }

    return {
      result: updated,
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
