import { NzEarningsRate } from "../types/payroll-nz-types.js";
import { AuEarningsRate } from "../types/payroll-au-types.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface EarningsRateResult {
  earningsRateID: string;
  name: string;
  earningsType: string;
  rateType: string;
  ratePerUnit?: number;
  fixedAmount?: number;
  currentRecord?: boolean;
}

export interface ListEarningsRatesParams {
  page?: number;
}

export async function listXeroEarningsRates(
  params: ListEarningsRatesParams = {},
): Promise<XeroClientResponse<EarningsRateResult[]>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    let rates: EarningsRateResult[];

    if (region === "AU") {
      const res = await xeroClient.payrollAUApi.getPayItems(
        xeroClient.tenantId,
        undefined,
        undefined,
        undefined,
        params.page,
      );

      const earningsRates = res.body.payItems?.earningsRates ?? [];
      rates = earningsRates.map((r: AuEarningsRate) => ({
        earningsRateID: r.earningsRateID ?? "",
        name: r.name ?? "",
        earningsType: String(r.earningsType ?? ""),
        rateType: String(r.rateType ?? ""),
        ratePerUnit: r.ratePerUnit ? Number(r.ratePerUnit) : undefined,
        currentRecord: r.currentRecord,
      }));
    } else {
      const api = region === "UK" ? xeroClient.payrollUKApi : xeroClient.payrollNZApi;
      const res = await api.getEarningsRates(xeroClient.tenantId, params.page);

      rates = ((res.body.earningsRates ?? []) as NzEarningsRate[]).map((r) => ({
        earningsRateID: r.earningsRateID ?? "",
        name: r.name ?? "",
        earningsType: String(r.earningsType ?? ""),
        rateType: String(r.rateType ?? ""),
        ratePerUnit: r.ratePerUnit,
        fixedAmount: r.fixedAmount,
        currentRecord: r.currentRecord,
      }));
    }

    return { result: rates, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
