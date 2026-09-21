import { Budget } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export async function listXeroBudgets(): Promise<XeroClientResponse<Budget[]>> {
  try {
    await xeroClient.authenticate();
    const response = await xeroClient.accountingApi.getBudgets(
      xeroClient.tenantId,
      undefined,
      undefined,
      undefined,
      getClientHeaders(),
    );
    return { result: response.body.budgets ?? [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getXeroBudget(
  budgetId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<XeroClientResponse<Budget[]>> {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return {
      result: null,
      isError: true,
      error: "dateFrom must be on or before dateTo.",
    };
  }

  try {
    await xeroClient.authenticate();
    const response = await xeroClient.accountingApi.getBudget(
      xeroClient.tenantId,
      budgetId,
      dateTo,
      dateFrom,
      getClientHeaders(),
    );
    return { result: response.body.budgets ?? [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
