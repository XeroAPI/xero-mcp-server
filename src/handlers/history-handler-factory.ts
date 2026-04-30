import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { HistoryRecord, HistoryRecords } from "xero-node";

type GetHistoryMethod = (
  xeroTenantId: string,
  entityId: string,
  options?: { headers: { [name: string]: string } },
) => Promise<{ response: unknown; body: HistoryRecords }>;

type CreateHistoryMethod = (
  xeroTenantId: string,
  entityId: string,
  historyRecords: HistoryRecords,
  idempotencyKey?: string,
  options?: { headers: { [name: string]: string } },
) => Promise<{ response: unknown; body: HistoryRecords }>;

export interface HistoryEntityConfig {
  getMethod: GetHistoryMethod;
  createMethod: CreateHistoryMethod;
}

/**
 * Get history records for a Xero entity
 */
export async function getEntityHistory(
  entityId: string,
  config: HistoryEntityConfig,
): Promise<XeroClientResponse<HistoryRecord[]>> {
  try {
    await xeroClient.authenticate();

    const response = await config.getMethod.call(
      xeroClient.accountingApi,
      xeroClient.tenantId,
      entityId,
      getClientHeaders(),
    );

    return {
      result: response.body.historyRecords ?? [],
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

/**
 * Add a note to a Xero entity's history.
 * Notes are immutable once created — they cannot be edited or deleted.
 */
export async function addEntityNote(
  entityId: string,
  note: string,
  config: HistoryEntityConfig,
): Promise<XeroClientResponse<HistoryRecord>> {
  try {
    await xeroClient.authenticate();

    const historyRecords: HistoryRecords = {
      historyRecords: [{ details: note }],
    };

    const response = await config.createMethod.call(
      xeroClient.accountingApi,
      xeroClient.tenantId,
      entityId,
      historyRecords,
      undefined,
      getClientHeaders(),
    );

    const created = response.body.historyRecords?.[0];

    if (!created) {
      throw new Error("Note creation failed — no record returned.");
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
