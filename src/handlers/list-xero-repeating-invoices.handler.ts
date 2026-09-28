import { RepeatingInvoice } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import {
  REPEATING_INVOICE_PAGE_SIZE,
  RepeatingInvoiceStatus,
  RepeatingInvoiceType,
} from "../types/repeating-invoice.js";
import { XeroClientResponse } from "../types/tool-response.js";

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ListRepeatingInvoicesParams {
  page?: number;
  contactId?: string;
  status?: RepeatingInvoiceStatus;
  type?: RepeatingInvoiceType;
}

export function buildRepeatingInvoiceWhere(
  params: ListRepeatingInvoicesParams,
): string | undefined {
  const parts: string[] = [];

  if (params.contactId) {
    if (!GUID_RE.test(params.contactId)) {
      throw new Error("contactId must be a Xero GUID.");
    }
    parts.push(`Contact.ContactID=guid("${params.contactId}")`);
  }

  if (params.status) {
    parts.push(`Status=="${params.status}"`);
  }

  if (params.type) {
    parts.push(`Type=="${params.type}"`);
  }

  return parts.length > 0 ? parts.join(" AND ") : undefined;
}

async function getRepeatingInvoices(
  params: ListRepeatingInvoicesParams,
): Promise<RepeatingInvoice[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getRepeatingInvoices(
    xeroClient.tenantId,
    buildRepeatingInvoiceWhere(params),
    undefined,
    getClientHeaders(),
  );

  const all = response.body.repeatingInvoices ?? [];
  const page = params.page && params.page > 0 ? params.page : 1;
  const start = (page - 1) * REPEATING_INVOICE_PAGE_SIZE;
  return all.slice(start, start + REPEATING_INVOICE_PAGE_SIZE);
}

/**
 * List repeating invoice templates from Xero.
 * The Accounting API does not paginate this endpoint, so results are sliced locally.
 */
export async function listXeroRepeatingInvoices(
  params: ListRepeatingInvoicesParams = {},
): Promise<XeroClientResponse<RepeatingInvoice[]>> {
  try {
    const repeatingInvoices = await getRepeatingInvoices(params);

    return {
      result: repeatingInvoices,
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
