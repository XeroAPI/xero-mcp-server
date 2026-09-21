import { Account } from "xero-node";
import { accounting, arrayOf, BookkeepingError, JsonObject, requireValue, stringOf, valueOf } from "./core.js";

export { getLockDates } from "./core.js";

export async function listAccounts(includeArchived = false): Promise<JsonObject[]> {
  const body = await accounting("getAccounts", [undefined, undefined, "Code ASC"], "GET /Accounts");
  return arrayOf<JsonObject>(body, "accounts").filter((account) => includeArchived || stringOf(account, "status") !== "ARCHIVED");
}

export async function getAccount(accountId: string): Promise<JsonObject> {
  const body = await accounting("getAccount", [accountId], "GET /Accounts/{accountID}");
  return requireValue(arrayOf<JsonObject>(body, "accounts")[0], "Account not found.", "GET /Accounts/{accountID}");
}

export async function createAccount(account: JsonObject, idempotencyKey?: string): Promise<JsonObject> {
  const accounts = await listAccounts(true);
  const duplicate = accounts.find((candidate) => stringOf(candidate, "code") === account.code);
  if (duplicate) throw new BookkeepingError(`Account code ${String(account.code)} already exists. No duplicate account was created.`, "POST /Accounts", { status: 409, details: { existingAccountID: valueOf(duplicate, "accountID"), code: account.code } });
  const body = await accounting("createAccount", [account, idempotencyKey], "POST /Accounts");
  return requireValue(arrayOf<JsonObject>(body, "accounts")[0], "Xero did not return the created account.", "POST /Accounts");
}

export async function updateAccount(accountId: string, account: JsonObject, idempotencyKey?: string): Promise<JsonObject> {
  const body = await accounting("updateAccount", [accountId, { accounts: [{ ...account, accountID: accountId }] }, idempotencyKey], "POST /Accounts/{accountID}");
  return requireValue(arrayOf<JsonObject>(body, "accounts")[0], "Xero did not return the updated account.", "POST /Accounts/{accountID}");
}

export async function archiveAccount(accountId: string, idempotencyKey?: string): Promise<JsonObject> {
  return updateAccount(accountId, { status: Account.StatusEnum.ARCHIVED }, idempotencyKey);
}

export async function restoreAccount(accountId: string, idempotencyKey?: string): Promise<JsonObject> {
  return updateAccount(accountId, { status: Account.StatusEnum.ACTIVE }, idempotencyKey);
}

export async function listTrackingCategories(includeArchived = false): Promise<JsonObject[]> {
  const body = await accounting("getTrackingCategories", [undefined, undefined, includeArchived], "GET /TrackingCategories");
  return arrayOf<JsonObject>(body, "trackingCategories");
}

export async function getTrackingCategory(trackingCategoryId: string): Promise<JsonObject> {
  const body = await accounting("getTrackingCategory", [trackingCategoryId], "GET /TrackingCategories/{trackingCategoryID}");
  return requireValue(arrayOf<JsonObject>(body, "trackingCategories")[0], "Tracking category not found.", "GET /TrackingCategories/{trackingCategoryID}");
}

export async function createTrackingCategory(name: string, idempotencyKey?: string): Promise<JsonObject> {
  const existing = (await listTrackingCategories(false)).find((category) => stringOf(category, "name") === name);
  if (existing) throw new BookkeepingError(`Tracking category ${name} already exists. No duplicate category was created.`, "POST /TrackingCategories", { status: 409, details: { existingTrackingCategoryID: valueOf(existing, "trackingCategoryID") } });
  const body = await accounting("createTrackingCategory", [{ name }, idempotencyKey], "POST /TrackingCategories");
  return requireValue(arrayOf<JsonObject>(body, "trackingCategories")[0], "Xero did not return the created tracking category.", "POST /TrackingCategories");
}

export async function updateTrackingCategory(trackingCategoryId: string, name: string, idempotencyKey?: string): Promise<JsonObject> {
  const body = await accounting("updateTrackingCategory", [trackingCategoryId, { name }, idempotencyKey], "POST /TrackingCategories/{trackingCategoryID}");
  return requireValue(arrayOf<JsonObject>(body, "trackingCategories")[0], "Xero did not return the updated tracking category.", "POST /TrackingCategories/{trackingCategoryID}");
}

export async function archiveTrackingCategory(trackingCategoryId: string): Promise<JsonObject> {
  const body = await accounting("deleteTrackingCategory", [trackingCategoryId], "DELETE /TrackingCategories/{trackingCategoryID}");
  return arrayOf<JsonObject>(body, "trackingCategories")[0] ?? { trackingCategoryID: trackingCategoryId, status: "ARCHIVED" };
}

export async function resolveTracking(tracking: JsonObject): Promise<JsonObject> {
  const categories = await listTrackingCategories(false);
  const categoryId = typeof tracking.trackingCategoryID === "string" ? tracking.trackingCategoryID : undefined;
  const categoryName = typeof tracking.name === "string" ? tracking.name : undefined;
  const category = categories.find((candidate) => (categoryId && candidate.trackingCategoryID === categoryId) || (categoryName && candidate.name === categoryName));
  if (!category) throw new BookkeepingError("Tracking category was not found. Read tracking categories before posting this transaction.", "GET /TrackingCategories", { status: 422, details: { requestedTracking: tracking } });
  const options = Array.isArray(category.options) ? (category.options as JsonObject[]) : [];
  const optionId = typeof tracking.trackingOptionID === "string" ? tracking.trackingOptionID : undefined;
  const optionName = typeof tracking.option === "string" ? tracking.option : undefined;
  const option = options.find((candidate) => (optionId && candidate.trackingOptionID === optionId) || (optionName && candidate.name === optionName));
  if (!option) throw new BookkeepingError("Tracking option was not found in the requested category. No transaction was posted.", "GET /TrackingCategories", { status: 422, details: { requestedTracking: tracking, categoryID: category.trackingCategoryID } });
  return { trackingCategoryID: category.trackingCategoryID, name: category.name, trackingOptionID: option.trackingOptionID, option: option.name };
}

export async function createTrackingOption(trackingCategoryId: string, name: string, idempotencyKey?: string): Promise<JsonObject> {
  const category = await getTrackingCategory(trackingCategoryId);
  const duplicate = (Array.isArray(category.options) ? (category.options as JsonObject[]) : []).find((option) => option.name === name && option.status !== "ARCHIVED");
  if (duplicate) throw new BookkeepingError(`Tracking option ${name} already exists in this category.`, "POST /TrackingCategories/{trackingCategoryID}/Options", { status: 409, details: { existingTrackingOptionID: duplicate.trackingOptionID } });
  const body = await accounting("createTrackingOptions", [trackingCategoryId, { name }, idempotencyKey], "POST /TrackingCategories/{trackingCategoryID}/Options");
  return requireValue(arrayOf<JsonObject>(body, "options")[0], "Xero did not return the created tracking option.", "POST /TrackingCategories/{trackingCategoryID}/Options");
}

export async function updateTrackingOption(trackingCategoryId: string, trackingOptionId: string, name: string, idempotencyKey?: string): Promise<JsonObject> {
  const body = await accounting("updateTrackingOptions", [trackingCategoryId, trackingOptionId, { name }, idempotencyKey], "POST /TrackingCategories/{trackingCategoryID}/Options/{trackingOptionID}");
  return requireValue(arrayOf<JsonObject>(body, "options")[0], "Xero did not return the updated tracking option.", "POST /TrackingCategories/{trackingCategoryID}/Options/{trackingOptionID}");
}

export async function archiveTrackingOption(trackingCategoryId: string, trackingOptionId: string): Promise<JsonObject> {
  const body = await accounting("deleteTrackingOptions", [trackingCategoryId, trackingOptionId], "DELETE /TrackingCategories/{trackingCategoryID}/Options/{trackingOptionID}");
  return arrayOf<JsonObject>(body, "options")[0] ?? { trackingCategoryID: trackingCategoryId, trackingOptionID: trackingOptionId, status: "ARCHIVED" };
}
