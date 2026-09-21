import { xeroClient } from "../clients/xero-client.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { formatError } from "../helpers/format-error.js";

export type JsonObject = Record<string, unknown>;

export type Pagination = {
  page?: number;
  pageSize?: number;
  hasMore: boolean;
  nextPage?: number;
  nextOffset?: number;
};

export class BookkeepingError extends Error {
  public readonly status?: number;
  public readonly endpoint: string;
  public readonly retryable: boolean;
  public readonly details?: unknown;
  public readonly missingScope?: string;

  constructor(
    message: string,
    endpoint: string,
    options: {
      status?: number;
      retryable?: boolean;
      details?: unknown;
      missingScope?: string;
    } = {},
  ) {
    super(message);
    this.name = "BookkeepingError";
    this.endpoint = endpoint;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.missingScope = options.missingScope;
  }
}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bodyOf<T>(response: unknown): T {
  if (isObject(response) && "body" in response) return response.body as T;
  return response as T;
}

export function arrayOf<T>(value: unknown, key: string): T[] {
  const record = isObject(value) ? value[key] : undefined;
  return Array.isArray(record) ? (record as T[]) : [];
}

export function valueOf(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined;
}

export function stringOf(value: unknown, key: string): string | undefined {
  const result = valueOf(value, key);
  return typeof result === "string" ? result : undefined;
}

export function numberOf(value: unknown, key: string): number | undefined {
  const result = valueOf(value, key);
  if (typeof result === "number") return result;
  if (typeof result === "string" && result.trim() !== "") {
    const parsed = Number(result);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function quoteQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function dateQuery(field: string, date: string, operator: ">=" | "<="): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${field}${operator}DateTime(${year},${month},${day})`;
}

export function combineWhere(parts: Array<string | undefined>): string | undefined {
  const values = parts.filter(Boolean) as string[];
  return values.length ? values.join(" && ") : undefined;
}

function extractStatus(error: unknown): number | undefined {
  if (!isObject(error)) return undefined;
  const response = valueOf(error, "response");
  if (!isObject(response)) return undefined;
  const statusCode = valueOf(response, "statusCode");
  const status = valueOf(response, "status");
  return typeof statusCode === "number" ? statusCode : typeof status === "number" ? status : undefined;
}

export function sanitizeErrorDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeErrorDetails);
  if (!isObject(value)) return value;
  const sensitive = new Set(["authorization", "access_token", "refresh_token", "client_secret", "api_key", "apikey", "password", "token"]);
  const result: JsonObject = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = sensitive.has(key.toLowerCase()) ? "[REDACTED]" : sanitizeErrorDetails(nested);
  }
  return result;
}

function errorDetails(error: unknown): unknown {
  if (error instanceof BookkeepingError) return error.details;
  if (isObject(error)) {
    const response = valueOf(error, "response");
    if (isObject(response)) return sanitizeErrorDetails(valueOf(response, "body") ?? valueOf(response, "data"));
  }
  return undefined;
}

function retryableStatus(status?: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status ?? 0) >= 500;
}

export async function apiCall<T>(api: object, method: string, args: unknown[], endpoint = method): Promise<T> {
  try {
    await xeroClient.authenticate();
    const callable = Reflect.get(api, method);
    if (typeof callable !== "function") throw new Error(`The installed Xero SDK does not expose ${method}.`);
    const response = await callable.apply(api, [xeroClient.tenantId, ...args, getClientHeaders()]);
    return bodyOf<T>(response);
  } catch (error) {
    if (error instanceof BookkeepingError) throw error;
    const status = extractStatus(error);
    const message = formatError(error);
    const lower = message.toLowerCase();
    const missingScope = lower.includes("insufficient_scope") || lower.includes("insufficient scope")
      ? "The Xero OAuth token is missing the scope required by this endpoint. Reconnect after adding the scope listed in the connector documentation."
      : undefined;
    throw new BookkeepingError(message, endpoint, { status, retryable: retryableStatus(status), details: errorDetails(error), missingScope });
  }
}

export const accounting = (method: string, args: unknown[], endpoint?: string) => apiCall<unknown>(xeroClient.accountingApi, method, args, endpoint);
export const finance = (method: string, args: unknown[], endpoint?: string) => apiCall<unknown>(xeroClient.financeApi, method, args, endpoint);
export const projects = (method: string, args: unknown[], endpoint?: string) => apiCall<unknown>(xeroClient.projectApi, method, args, endpoint);
export const assets = (method: string, args: unknown[], endpoint?: string) => apiCall<unknown>(xeroClient.assetApi, method, args, endpoint);

export function requireValue<T>(value: T | undefined | null, message: string, endpoint: string): T {
  if (value === undefined || value === null || value === "") throw new BookkeepingError(message, endpoint, { status: 422 });
  return value;
}

function dateIsLocked(date: string, lockDate?: string): boolean {
  return Boolean(lockDate && date <= lockDate.slice(0, 10));
}

export async function getLockDates(): Promise<JsonObject> {
  const body = await accounting("getOrganisations", [], "GET /Organisations");
  const organisation = arrayOf<JsonObject>(body, "organisations")[0] ?? {};
  return {
    tenantId: xeroClient.tenantId,
    periodLockDate: stringOf(organisation, "periodLockDate") ?? null,
    endOfYearLockDate: stringOf(organisation, "endOfYearLockDate") ?? null,
    financialYearEndDay: numberOf(organisation, "financialYearEndDay") ?? null,
    financialYearEndMonth: numberOf(organisation, "financialYearEndMonth") ?? null,
    baseCurrency: stringOf(organisation, "baseCurrency") ?? null,
    organisationStatus: stringOf(organisation, "organisationStatus") ?? null,
  };
}

export async function assertDateUnlocked(date?: string): Promise<void> {
  if (!date) return;
  const locks = await getLockDates();
  const periodLockDate = typeof locks.periodLockDate === "string" ? locks.periodLockDate : undefined;
  const endOfYearLockDate = typeof locks.endOfYearLockDate === "string" ? locks.endOfYearLockDate : undefined;
  if (dateIsLocked(date, periodLockDate) || dateIsLocked(date, endOfYearLockDate)) {
    throw new BookkeepingError(`The requested date ${date} is on or before a Xero lock date. Review the period before posting.`, "GET /Organisations", { status: 409, details: locks });
  }
}
