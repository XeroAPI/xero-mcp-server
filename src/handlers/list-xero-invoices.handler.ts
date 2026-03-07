import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

function buildWhereClause(
  type?: string,
  dateFrom?: string,
  dateTo?: string,
): string | undefined {
  const clauses: string[] = [];

  if (type) {
    clauses.push(`Type=="${type}"`);
  }

  if (dateFrom) {
    const [year, month, day] = dateFrom.split("-").map(Number);
    clauses.push(`Date>=DateTime(${year},${month},${day})`);
  }

  if (dateTo) {
    const [year, month, day] = dateTo.split("-").map(Number);
    clauses.push(`Date<=DateTime(${year},${month},${day})`);
  }

  return clauses.length > 0 ? clauses.join("&&") : undefined;
}

async function getInvoices(
  invoiceNumbers?: string[],
  contactIds?: string[],
  page?: number,
  orderBy?: string,
  orderDirection?: string,
  status?: string,
  type?: string,
  dateFrom?: string,
  dateTo?: string,
  pageSize?: number,
): Promise<Invoice[]> {
  await xeroClient.authenticate();

  const where = buildWhereClause(type, dateFrom, dateTo);
  const order = `${orderBy ?? "UpdatedDateUTC"} ${orderDirection ?? "DESC"}`;
  const statuses = status ? [status] : undefined;

  const invoices = await xeroClient.accountingApi.getInvoices(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    where, // where
    order, // order
    undefined, // iDs
    invoiceNumbers, // invoiceNumbers
    contactIds, // contactIDs
    statuses, // statuses
    page,
    false, // includeArchived
    false, // createdByMyApp
    undefined, // unitdp
    false, // summaryOnly
    pageSize ?? 100, // pageSize
    undefined, // searchTerm
    getClientHeaders(),
  );
  return invoices.body.invoices ?? [];
}

/**
 * List all invoices from Xero
 */
export async function listXeroInvoices(
  page: number = 1,
  contactIds?: string[],
  invoiceNumbers?: string[],
  orderBy?: string,
  orderDirection?: string,
  status?: string,
  type?: string,
  dateFrom?: string,
  dateTo?: string,
  pageSize?: number,
): Promise<XeroClientResponse<Invoice[]>> {
  try {
    const invoices = await getInvoices(
      invoiceNumbers,
      contactIds,
      page,
      orderBy,
      orderDirection,
      status,
      type,
      dateFrom,
      dateTo,
      pageSize,
    );

    return {
      result: invoices,
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
