import { Buffer } from "node:buffer";
import { BankTransaction, Contact, Invoice, ManualJournal } from "xero-node";

import { accounting, arrayOf, assets, assertDateUnlocked, combineWhere, dateQuery, finance, isObject, JsonObject, numberOf, Pagination, projects, quoteQueryValue, requireValue, sanitizeErrorDetails, stringOf, valueOf, BookkeepingError } from "./core.js";
import { listAccounts, resolveTracking } from "./accounts.js";

export { BookkeepingError, getLockDates } from "./core.js";
export { archiveAccount, createAccount, getAccount, listAccounts, restoreAccount, updateAccount, archiveTrackingCategory, archiveTrackingOption, createTrackingCategory, createTrackingOption, getTrackingCategory, listTrackingCategories, resolveTracking, updateTrackingCategory, updateTrackingOption } from "./accounts.js";
export { cashFlowStatement, getTaxReport, listTaxReports, reportAged, reportBalanceSheet, reportBankSummary, reportBudgetSummary, reportExecutiveSummary, reportProfitAndLoss, reportTrialBalance } from "./reports.js";

async function resolvedLineItems(lineItems: JsonObject[]): Promise<JsonObject[]> {
  await validateAccountReferences(lineItems);
  return Promise.all(
    lineItems.map(async (lineItem) => ({
      ...lineItem,
      ...(Array.isArray(lineItem.tracking)
        ? { tracking: await Promise.all((lineItem.tracking as JsonObject[]).map(resolveTracking)) }
        : {}),
    })),
  );
}

async function resolvedJournalLines(lines: JsonObject[]): Promise<JsonObject[]> {
  await validateAccountReferences(lines);
  return Promise.all(
    lines.map(async (line) => ({
      ...line,
      ...(Array.isArray(line.tracking)
        ? { tracking: await Promise.all((line.tracking as JsonObject[]).map(resolveTracking)) }
        : {}),
    })),
  );
}

async function validateAccountReferences(lines: JsonObject[]): Promise<void> {
  const references = lines
    .map((line) => ({
      accountCode: typeof line.accountCode === "string" ? line.accountCode : undefined,
      accountID: typeof line.accountID === "string" ? line.accountID : undefined,
    }))
    .filter((reference) => reference.accountCode || reference.accountID);
  if (!references.length) return;
  const knownAccounts = await listAccounts(true);
  for (const reference of references) {
    const found = knownAccounts.some(
      (account) =>
        (!reference.accountCode || account.code === reference.accountCode) &&
        (!reference.accountID || account.accountID === reference.accountID),
    );
    if (!found) {
      throw new BookkeepingError(
        `Account ${reference.accountCode ?? reference.accountID} was not found. No transaction was posted.`,
        "GET /Accounts",
        { status: 422, details: reference },
      );
    }
  }
}

export function validateBalancedJournal(lines: Array<{ lineAmount?: number }>): void {
  if (lines.length < 2) {
    throw new BookkeepingError("A manual journal must contain at least two lines.", "POST /ManualJournals", { status: 422 });
  }
  const total = lines.reduce((sum, line) => sum + Number(line.lineAmount ?? 0), 0);
  if (Math.abs(total) > 0.005) {
    throw new BookkeepingError(
      `Manual journal is not balanced. The line total is ${total.toFixed(2)}; it must equal zero.`,
      "POST /ManualJournals",
      { status: 422, details: { total } },
    );
  }
}

export async function getBankTransaction(bankTransactionId: string): Promise<JsonObject> {
  const body = await accounting("getBankTransaction", [bankTransactionId], "GET /BankTransactions/{bankTransactionID}");
  return requireValue(arrayOf<JsonObject>(body, "bankTransactions")[0], "Bank transaction not found.", "GET /BankTransactions/{bankTransactionID}");
}

export async function listBankTransactions(input: {
  bankAccountId?: string;
  contactId?: string;
  type?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  reference?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ items: JsonObject[]; pagination: Pagination }> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const where = combineWhere([
    input.bankAccountId ? `BankAccount.AccountID==guid("${quoteQueryValue(input.bankAccountId)}")` : undefined,
    input.contactId ? `Contact.ContactID==guid("${quoteQueryValue(input.contactId)}")` : undefined,
    input.type ? `Type=="${quoteQueryValue(input.type)}"` : undefined,
    input.status ? `Status=="${quoteQueryValue(input.status)}"` : undefined,
    input.fromDate ? dateQuery("Date", input.fromDate, ">=") : undefined,
    input.toDate ? dateQuery("Date", input.toDate, "<=") : undefined,
    input.reference ? `Reference=="${quoteQueryValue(input.reference)}"` : undefined,
  ]);
  const body = await accounting(
    "getBankTransactions",
    [undefined, where, "Date DESC", page, undefined, pageSize],
    "GET /BankTransactions",
  );
  let items = arrayOf<JsonObject>(body, "bankTransactions");
  items = items.filter((transaction) => {
    const amount = numberOf(transaction, "total");
    return (
      (input.amountMin === undefined || (amount !== undefined && amount >= input.amountMin)) &&
      (input.amountMax === undefined || (amount !== undefined && amount <= input.amountMax))
    );
  });
  return {
    items,
    pagination: {
      page,
      pageSize,
      hasMore: items.length >= pageSize,
      ...(items.length >= pageSize ? { nextPage: page + 1 } : {}),
    },
  };
}

export async function createBankTransaction(input: {
  type: string;
  bankAccountId: string;
  contactId?: string;
  lineItems: JsonObject[];
  reference?: string;
  date?: string;
  sourceUrl?: string;
  idempotencyKey?: string;
}): Promise<JsonObject> {
  await assertDateUnlocked(input.date);
  const lineItems = await resolvedLineItems(input.lineItems);
  const duplicate = input.reference
    ? (await listBankTransactions({ bankAccountId: input.bankAccountId, reference: input.reference, pageSize: 100 })).items.find(
        (transaction) =>
          stringOf(transaction, "reference") === input.reference &&
          (!input.date || stringOf(transaction, "date")?.slice(0, 10) === input.date),
      )
    : undefined;
  if (duplicate) {
    throw new BookkeepingError(
      "A bank transaction with the same account, date, and reference already exists. No duplicate was created.",
      "POST /BankTransactions",
      { status: 409, details: { existingBankTransactionID: duplicate.bankTransactionID } },
    );
  }
  const transaction: JsonObject = {
    type: input.type,
    bankAccount: { accountID: input.bankAccountId },
    ...(input.contactId ? { contact: { contactID: input.contactId } } : {}),
    lineItems,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    reference: input.reference,
    url: input.sourceUrl,
    status: BankTransaction.StatusEnum.AUTHORISED,
  };
  const body = await accounting(
    "createBankTransactions",
    [{ bankTransactions: [transaction] }, true, undefined, input.idempotencyKey],
    "POST /BankTransactions",
  );
  return requireValue(arrayOf<JsonObject>(body, "bankTransactions")[0], "Xero did not return the created bank transaction.", "POST /BankTransactions");
}

export async function updateBankTransaction(
  bankTransactionId: string,
  patch: JsonObject,
  idempotencyKey?: string,
): Promise<JsonObject> {
  const existing = await getBankTransaction(bankTransactionId);
  const date = typeof patch.date === "string" ? patch.date : stringOf(existing, "date");
  await assertDateUnlocked(date);
  const lineItems = Array.isArray(patch.lineItems)
    ? await resolvedLineItems(patch.lineItems as JsonObject[])
    : valueOf(existing, "lineItems");
  const updated = {
    ...existing,
    ...patch,
    ...(lineItems ? { lineItems } : {}),
    bankTransactionID: bankTransactionId,
  };
  const body = await accounting(
    "updateBankTransaction",
    [bankTransactionId, { bankTransactions: [updated] }, undefined, idempotencyKey],
    "POST /BankTransactions/{bankTransactionID}",
  );
  return requireValue(arrayOf<JsonObject>(body, "bankTransactions")[0], "Xero did not return the updated bank transaction.", "POST /BankTransactions/{bankTransactionID}");
}

export async function createBankTransfer(input: {
  fromBankAccountId: string;
  toBankAccountId: string;
  amount: number;
  date?: string;
  reference?: string;
  currencyRate?: number;
  idempotencyKey?: string;
}): Promise<JsonObject> {
  if (input.fromBankAccountId === input.toBankAccountId) {
    throw new BookkeepingError("A bank transfer must use two different bank accounts.", "POST /BankTransfers", { status: 422 });
  }
  await assertDateUnlocked(input.date);
  const transferDate = input.date ?? new Date().toISOString().slice(0, 10);
  const duplicate = input.reference
    ? (await listBankTransfers({ fromDate: transferDate, toDate: transferDate, pageSize: 500 })).items.find(
        (candidate) =>
          candidate.reference === input.reference &&
          candidate.amount === input.amount &&
          valueOf(valueOf(candidate, "fromBankAccount"), "accountID") === input.fromBankAccountId &&
          valueOf(valueOf(candidate, "toBankAccount"), "accountID") === input.toBankAccountId,
      )
    : undefined;
  if (duplicate) {
    throw new BookkeepingError(
      "A bank transfer with the same accounts, date, amount, and reference already exists. No duplicate was created.",
      "POST /BankTransfers",
      { status: 409, details: { existingBankTransferID: duplicate.bankTransferID } },
    );
  }
  const transfer = {
    fromBankAccount: { accountID: input.fromBankAccountId },
    toBankAccount: { accountID: input.toBankAccountId },
    amount: input.amount,
    date: transferDate,
    reference: input.reference,
    currencyRate: input.currencyRate,
  };
  const body = await accounting(
    "createBankTransfer",
    [{ bankTransfers: [transfer] }, input.idempotencyKey],
    "POST /BankTransfers",
  );
  return requireValue(arrayOf<JsonObject>(body, "bankTransfers")[0], "Xero did not return the created bank transfer.", "POST /BankTransfers");
}

export async function getBankTransfer(bankTransferId: string): Promise<JsonObject> {
  const body = await accounting("getBankTransfer", [bankTransferId], "GET /BankTransfers/{bankTransferID}");
  return requireValue(arrayOf<JsonObject>(body, "bankTransfers")[0], "Bank transfer not found.", "GET /BankTransfers/{bankTransferID}");
}

export async function listBankTransfers(input: { fromDate?: string; toDate?: string; page?: number; pageSize?: number } = {}) {
  const where = combineWhere([
    input.fromDate ? dateQuery("Date", input.fromDate, ">=") : undefined,
    input.toDate ? dateQuery("Date", input.toDate, "<=") : undefined,
  ]);
  const body = await accounting("getBankTransfers", [undefined, where, "Date DESC"], "GET /BankTransfers");
  const all = arrayOf<JsonObject>(body, "bankTransfers");
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return {
    items,
    pagination: { page, pageSize, hasMore: start + pageSize < all.length, ...(start + pageSize < all.length ? { nextPage: page + 1 } : {}) },
  };
}

export async function getInvoice(invoiceId: string): Promise<JsonObject> {
  const body = await accounting("getInvoice", [invoiceId], "GET /Invoices/{InvoiceID}");
  return requireValue(arrayOf<JsonObject>(body, "invoices")[0], "Invoice not found.", "GET /Invoices/{InvoiceID}");
}

export async function listInvoices(input: {
  type?: "ACCREC" | "ACCPAY";
  contactId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  reference?: string;
  invoiceNumber?: string;
  unpaidOnly?: boolean;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
} = {}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const where = combineWhere([
    input.type ? `Type=="${input.type}"` : undefined,
    input.fromDate ? dateQuery("Date", input.fromDate, ">=") : undefined,
    input.toDate ? dateQuery("Date", input.toDate, "<=") : undefined,
    input.dueDateFrom ? dateQuery("DueDate", input.dueDateFrom, ">=") : undefined,
    input.dueDateTo ? dateQuery("DueDate", input.dueDateTo, "<=") : undefined,
    input.reference ? `Reference=="${quoteQueryValue(input.reference)}"` : undefined,
  ]);
  const body = await accounting(
    "getInvoices",
    [undefined, where, "Date DESC", undefined, input.invoiceNumber ? [input.invoiceNumber] : undefined, input.contactId ? [input.contactId] : undefined, input.status ? [input.status] : undefined, page, false, false, undefined, false, pageSize, input.searchTerm],
    "GET /Invoices",
  );
  let items = arrayOf<JsonObject>(body, "invoices");
  if (input.type) items = items.filter((invoice) => stringOf(invoice, "type") === input.type);
  if (input.unpaidOnly) items = items.filter((invoice) => (numberOf(invoice, "amountDue") ?? 0) > 0);
  return { items, pagination: { page, pageSize, hasMore: items.length >= pageSize, ...(items.length >= pageSize ? { nextPage: page + 1 } : {}) } };
}

export async function createInvoice(input: {
  type: "ACCREC" | "ACCPAY";
  contactId: string;
  lineItems: JsonObject[];
  date?: string;
  dueDate?: string;
  reference?: string;
  invoiceNumber?: string;
  sourceUrl?: string;
  currencyCode?: string;
  status?: string;
  idempotencyKey?: string;
}): Promise<JsonObject> {
  await assertDateUnlocked(input.date);
  if (input.invoiceNumber || input.reference) {
    const duplicate = (await listInvoices({
      type: input.type,
      contactId: input.contactId,
      invoiceNumber: input.invoiceNumber,
      reference: input.reference,
      page: 1,
      pageSize: 100,
    })).items.find(
      (invoice) =>
        (!input.invoiceNumber || invoice.invoiceNumber === input.invoiceNumber) &&
        (!input.reference || invoice.reference === input.reference) &&
        (!input.date || stringOf(invoice, "date")?.slice(0, 10) === input.date),
    );
    if (duplicate) {
      throw new BookkeepingError(
        "An invoice with the same contact, date, and reference/invoice number already exists. No duplicate was created.",
        "POST /Invoices",
        { status: 409, details: { existingInvoiceID: duplicate.invoiceID } },
      );
    }
  }
  const lineItems = await resolvedLineItems(input.lineItems);
  const invoice: JsonObject = {
    type: input.type,
    contact: { contactID: input.contactId },
    lineItems,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    dueDate: input.dueDate,
    reference: input.reference,
    invoiceNumber: input.invoiceNumber ?? (input.type === "ACCPAY" ? input.reference : undefined),
    url: input.sourceUrl,
    currencyCode: input.currencyCode,
    status: input.status ?? Invoice.StatusEnum.DRAFT,
  };
  const body = await accounting("createInvoices", [{ invoices: [invoice] }, true, undefined, input.idempotencyKey], "POST /Invoices");
  return requireValue(arrayOf<JsonObject>(body, "invoices")[0], "Xero did not return the created invoice.", "POST /Invoices");
}

export async function updateInvoice(invoiceId: string, patch: JsonObject, idempotencyKey?: string): Promise<JsonObject> {
  const existing = await getInvoice(invoiceId);
  const date = typeof patch.date === "string" ? patch.date : stringOf(existing, "date");
  await assertDateUnlocked(date);
  const lineItems = Array.isArray(patch.lineItems) ? await resolvedLineItems(patch.lineItems as JsonObject[]) : valueOf(existing, "lineItems");
  const body = await accounting("updateInvoice", [invoiceId, { invoices: [{ ...existing, ...patch, ...(lineItems ? { lineItems } : {}), invoiceID: invoiceId }] }, undefined, idempotencyKey], "POST /Invoices/{InvoiceID}");
  return requireValue(arrayOf<JsonObject>(body, "invoices")[0], "Xero did not return the updated invoice.", "POST /Invoices/{InvoiceID}");
}

export async function getPayment(paymentId: string): Promise<JsonObject> {
  const body = await accounting("getPayment", [paymentId], "GET /Payments/{PaymentID}");
  return requireValue(arrayOf<JsonObject>(body, "payments")[0], "Payment not found.", "GET /Payments/{PaymentID}");
}

export async function listPayments(input: { contactId?: string; fromDate?: string; toDate?: string; accountId?: string; invoiceId?: string; reference?: string; page?: number; pageSize?: number } = {}) {
  const where = combineWhere([
    input.contactId ? `Invoice.Contact.ContactID==guid("${quoteQueryValue(input.contactId)}")` : undefined,
    input.accountId ? `Account.AccountID==guid("${quoteQueryValue(input.accountId)}")` : undefined,
    input.fromDate ? dateQuery("Date", input.fromDate, ">=") : undefined,
    input.toDate ? dateQuery("Date", input.toDate, "<=") : undefined,
    input.reference ? `Reference=="${quoteQueryValue(input.reference)}"` : undefined,
  ]);
  const body = await accounting("getPayments", [undefined, where, "Date DESC", input.page ?? 1, input.pageSize ?? 100], "GET /Payments");
  let items = arrayOf<JsonObject>(body, "payments");
  if (input.invoiceId) items = items.filter((payment) => valueOf(valueOf(payment, "invoice"), "invoiceID") === input.invoiceId);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  return { items, pagination: { page, pageSize, hasMore: items.length >= pageSize, ...(items.length >= pageSize ? { nextPage: page + 1 } : {}) } };
}

export async function createPayment(input: { invoiceId?: string; creditNoteId?: string; accountId: string; amount: number; date?: string; reference?: string; idempotencyKey?: string }): Promise<JsonObject> {
  if (!input.invoiceId && !input.creditNoteId) throw new BookkeepingError("A payment must target an invoice or credit note.", "POST /Payments", { status: 422 });
  await assertDateUnlocked(input.date);
  const paymentDate = input.date ?? new Date().toISOString().slice(0, 10);
  if (input.reference) {
    const duplicate = (await listPayments({
      accountId: input.accountId,
      fromDate: paymentDate,
      toDate: paymentDate,
      reference: input.reference,
      page: 1,
      pageSize: 100,
    })).items.find(
      (payment) =>
        payment.reference === input.reference &&
        payment.amount === input.amount &&
        valueOf(valueOf(payment, "invoice"), "invoiceID") === input.invoiceId &&
        valueOf(valueOf(payment, "creditNote"), "creditNoteID") === input.creditNoteId,
    );
    if (duplicate) {
      throw new BookkeepingError(
        "A payment with the same target, date, amount, and reference already exists. No duplicate was created.",
        "POST /Payments",
        { status: 409, details: { existingPaymentID: duplicate.paymentID } },
      );
    }
  }
  const payment: JsonObject = {
    ...(input.invoiceId ? { invoice: { invoiceID: input.invoiceId } } : { creditNote: { creditNoteID: input.creditNoteId } }),
    account: { accountID: input.accountId },
    amount: input.amount,
    date: paymentDate,
    reference: input.reference,
  };
  const body = await accounting("createPayments", [{ payments: [payment] }, true, input.idempotencyKey], "POST /Payments");
  return requireValue(arrayOf<JsonObject>(body, "payments")[0], "Xero did not return the created payment.", "POST /Payments");
}

export async function deletePayment(paymentId: string, idempotencyKey?: string): Promise<JsonObject> {
  const body = await accounting("deletePayment", [paymentId, { status: "DELETED" }, idempotencyKey], "POST /Payments/{PaymentID}");
  return arrayOf<JsonObject>(body, "payments")[0] ?? { paymentID: paymentId, status: "DELETED" };
}

export async function getCreditNote(creditNoteId: string): Promise<JsonObject> {
  const body = await accounting("getCreditNote", [creditNoteId], "GET /CreditNotes/{CreditNoteID}");
  return requireValue(arrayOf<JsonObject>(body, "creditNotes")[0], "Credit note not found.", "GET /CreditNotes/{CreditNoteID}");
}

export async function listCreditNotes(input: { contactId?: string; status?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number } = {}) {
  const where = combineWhere([
    input.contactId ? `Contact.ContactID==guid("${quoteQueryValue(input.contactId)}")` : undefined,
    input.status ? `Status=="${quoteQueryValue(input.status)}"` : undefined,
    input.fromDate ? dateQuery("Date", input.fromDate, ">=") : undefined,
    input.toDate ? dateQuery("Date", input.toDate, "<=") : undefined,
  ]);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const body = await accounting("getCreditNotes", [undefined, where, "Date DESC", page, undefined, pageSize], "GET /CreditNotes");
  const items = arrayOf<JsonObject>(body, "creditNotes");
  return { items, pagination: { page, pageSize, hasMore: items.length >= pageSize, ...(items.length >= pageSize ? { nextPage: page + 1 } : {}) } };
}

export async function createCreditNoteAllocation(input: { creditNoteId: string; invoiceId: string; amount: number; date: string; idempotencyKey?: string }): Promise<JsonObject> {
  await assertDateUnlocked(input.date);
  const body = await accounting("createCreditNoteAllocation", [input.creditNoteId, { allocations: [{ invoice: { invoiceID: input.invoiceId }, amount: input.amount, date: input.date }] }, true, input.idempotencyKey], "POST /CreditNotes/{CreditNoteID}/Allocations");
  return requireValue(arrayOf<JsonObject>(body, "allocations")[0], "Xero did not return the credit allocation.", "POST /CreditNotes/{CreditNoteID}/Allocations");
}

export async function getManualJournal(manualJournalId: string): Promise<JsonObject> {
  const body = await accounting("getManualJournal", [manualJournalId], "GET /ManualJournals/{ManualJournalID}");
  return requireValue(arrayOf<JsonObject>(body, "manualJournals")[0], "Manual journal not found.", "GET /ManualJournals/{ManualJournalID}");
}

export async function listManualJournals(input: { fromDate?: string; toDate?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const where = combineWhere([
    input.status ? `Status=="${quoteQueryValue(input.status)}"` : undefined,
    input.fromDate ? dateQuery("Date", input.fromDate, ">=") : undefined,
    input.toDate ? dateQuery("Date", input.toDate, "<=") : undefined,
  ]);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const body = await accounting("getManualJournals", [undefined, where, "Date DESC", page, pageSize], "GET /ManualJournals");
  const items = arrayOf<JsonObject>(body, "manualJournals");
  return { items, pagination: { page, pageSize, hasMore: items.length >= pageSize, ...(items.length >= pageSize ? { nextPage: page + 1 } : {}) } };
}

export async function createManualJournal(input: { narration: string; lines: JsonObject[]; date?: string; status?: string; url?: string; showOnCashBasisReports?: boolean; idempotencyKey?: string }): Promise<JsonObject> {
  validateBalancedJournal(input.lines);
  await assertDateUnlocked(input.date);
  const lines = await resolvedJournalLines(input.lines);
  const duplicate = (await listManualJournals({ page: 1, pageSize: 100 })).items.find(
    (journal) => stringOf(journal, "narration") === input.narration && (!input.date || stringOf(journal, "date")?.slice(0, 10) === input.date),
  );
  if (duplicate) {
    throw new BookkeepingError("A manual journal with the same narration and date already exists. No duplicate was posted.", "POST /ManualJournals", { status: 409, details: { existingManualJournalID: duplicate.manualJournalID } });
  }
  const journal: JsonObject = {
    narration: input.narration,
    journalLines: lines,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    status: input.status ?? ManualJournal.StatusEnum.DRAFT,
    url: input.url,
    showOnCashBasisReports: input.showOnCashBasisReports,
  };
  const body = await accounting("createManualJournals", [{ manualJournals: [journal] }, true, input.idempotencyKey], "POST /ManualJournals");
  return requireValue(arrayOf<JsonObject>(body, "manualJournals")[0], "Xero did not return the created manual journal.", "POST /ManualJournals");
}

export async function updateManualJournal(manualJournalId: string, patch: JsonObject, idempotencyKey?: string): Promise<JsonObject> {
  const existing = await getManualJournal(manualJournalId);
  const lines = Array.isArray(patch.journalLines) ? patch.journalLines as JsonObject[] : undefined;
  if (lines) validateBalancedJournal(lines);
  await assertDateUnlocked(typeof patch.date === "string" ? patch.date : stringOf(existing, "date"));
  const resolved = lines ? await resolvedJournalLines(lines) : valueOf(existing, "journalLines");
  const body = await accounting("updateManualJournal", [manualJournalId, { manualJournals: [{ ...existing, ...patch, ...(resolved ? { journalLines: resolved } : {}), manualJournalID: manualJournalId }] }, idempotencyKey], "POST /ManualJournals/{ManualJournalID}");
  return requireValue(arrayOf<JsonObject>(body, "manualJournals")[0], "Xero did not return the updated manual journal.", "POST /ManualJournals/{ManualJournalID}");
}

export async function listJournals(input: {
  fromDate?: string;
  toDate?: string;
  accountCode?: string;
  accountId?: string;
  trackingOptionId?: string;
  contactId?: string;
  sourceType?: string;
  offset?: number;
  pageSize?: number;
} = {}) {
  const offset = input.offset ?? 0;
  const pageSize = input.pageSize ?? 100;
  const body = await accounting("getJournals", [undefined, offset, false], "GET /Journals");
  let journals = arrayOf<JsonObject>(body, "journals");
  journals = journals.filter((journal) => {
    const date = stringOf(journal, "journalDate")?.slice(0, 10);
    const dateOkay =
      (!input.fromDate || (date !== undefined && date >= input.fromDate)) &&
      (!input.toDate || (date !== undefined && date <= input.toDate));
    const sourceOkay = !input.sourceType || stringOf(journal, "sourceType") === input.sourceType;
    const lines = Array.isArray(journal.journalLines) ? (journal.journalLines as JsonObject[]) : [];
    const accountOkay =
      (!input.accountCode && !input.accountId) ||
      lines.some(
        (line) =>
          (!input.accountCode || line.accountCode === input.accountCode) &&
          (!input.accountId || line.accountID === input.accountId),
      );
    const trackingOkay =
      !input.trackingOptionId ||
      lines.some((line) =>
        Array.isArray(line.trackingCategories) &&
        (line.trackingCategories as JsonObject[]).some((tracking) => tracking.trackingOptionID === input.trackingOptionId),
      );
    const contactOkay = !input.contactId || stringOf(journal, "contactID") === input.contactId;
    return dateOkay && sourceOkay && accountOkay && trackingOkay && contactOkay;
  });
  const items = journals.slice(0, pageSize);
  return {
    items,
    pagination: {
      nextOffset: items.length >= pageSize ? offset + items.length : undefined,
      hasMore: items.length >= pageSize,
      pageSize,
    },
  };
}

export async function generalLedger(input: {
  accountCode?: string;
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  trackingOptionId?: string;
  sourceType?: string;
  offset?: number;
  pageSize?: number;
}) {
  const journalResult = await listJournals(input);
  const entries: JsonObject[] = [];
  for (const journal of journalResult.items) {
    const lines = Array.isArray(journal.journalLines) ? (journal.journalLines as JsonObject[]) : [];
    for (const line of lines) {
      if (input.accountCode && line.accountCode !== input.accountCode) continue;
      if (input.accountId && line.accountID !== input.accountId) continue;
      entries.push({
        date: journal.journalDate ?? null,
        description: line.description ?? null,
        debit: Math.max(Number(line.netAmount ?? 0), 0),
        credit: Math.max(-Number(line.netAmount ?? 0), 0),
        netAmount: line.netAmount ?? null,
        sourceType: journal.sourceType ?? null,
        sourceId: journal.sourceID ?? null,
        reference: journal.reference ?? null,
        journalId: journal.journalID ?? null,
        journalNumber: journal.journalNumber ?? null,
        accountCode: line.accountCode ?? null,
        accountId: line.accountID ?? null,
        accountName: line.accountName ?? null,
        taxAmount: line.taxAmount ?? null,
        tracking: line.trackingCategories ?? [],
      });
    }
  }
  entries.sort((left, right) => String(left.date).localeCompare(String(right.date)));
  let runningBalance = 0;
  for (const entry of entries) {
    runningBalance += Number(entry.netAmount ?? 0);
    entry.runningBalance = runningBalance;
  }
  return { entries, pagination: journalResult.pagination, warnings: ["Running balance starts at the first journal returned; Xero does not provide an opening balance in the Journals response."] };
}

export async function listBankStatementLines(input: {
  bankAccountId: string;
  fromDate: string;
  toDate: string;
  reconciled?: boolean;
  amount?: number;
  payeeOrReference?: string;
  page?: number;
  pageSize?: number;
}) {
  const start = new Date(`${input.fromDate}T00:00:00Z`).getTime();
  const end = new Date(`${input.toDate}T23:59:59Z`).getTime();
  if (end < start || end - start > 366 * 24 * 60 * 60 * 1000) {
    throw new BookkeepingError("Bank statement queries must cover a valid range of no more than 12 months.", "GET /BankStatementAccounting", { status: 422 });
  }
  const body = await finance("getBankStatementAccounting", [input.bankAccountId, input.fromDate, input.toDate, false], "GET /BankStatementAccounting");
  const statements = arrayOf<JsonObject>(body, "statements");
  let lines: JsonObject[] = [];
  for (const statement of statements) {
    const statementLines = Array.isArray(statement.statementLines) ? (statement.statementLines as JsonObject[]) : [];
    lines.push(
      ...statementLines.map((line) => ({
        ...line,
        statementId: statement.statementId ?? null,
        statementStartDate: statement.startDate ?? null,
        statementEndDate: statement.endDate ?? null,
        importedDateTimeUtc: statement.importedDateTimeUtc ?? null,
        importSource: statement.importSource ?? null,
      })),
    );
  }
  lines = lines.filter((line) => {
    const lineAmount = numberOf(line, "amount");
    const text = `${stringOf(line, "payee") ?? ""} ${stringOf(line, "reference") ?? ""}`.toLowerCase();
    return (
      (input.reconciled === undefined || valueOf(line, "isReconciled") === input.reconciled) &&
      (input.amount === undefined || lineAmount === input.amount) &&
      (!input.payeeOrReference || text.includes(input.payeeOrReference.toLowerCase()))
    );
  });
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const startIndex = (page - 1) * pageSize;
  const items = lines.slice(startIndex, startIndex + pageSize);
  return {
    bankAccountId: input.bankAccountId,
    items,
    pagination: { page, pageSize, hasMore: startIndex + pageSize < lines.length, ...(startIndex + pageSize < lines.length ? { nextPage: page + 1 } : {}) },
    warnings: [
      "Xero exposes statement lines through the Finance Bank Statement Accounting endpoint, but does not expose a public API to reconcile or unreconcile lines. The data returned here is read-only and may be limited to data available to the authorized Finance API scope.",
    ],
  };
}

export async function getBankStatementLine(input: { bankAccountId: string; fromDate: string; toDate: string; statementLineId: string }): Promise<JsonObject> {
  const result = await listBankStatementLines({ ...input, page: 1, pageSize: 500 });
  const line = result.items.find((candidate) => candidate.statementLineId === input.statementLineId);
  return requireValue(line, "Bank statement line not found in the requested date range.", "GET /BankStatementAccounting");
}

export async function findReconciliationCandidates(input: {
  bankAccountId: string;
  fromDate: string;
  toDate: string;
  amount?: number;
  payeeOrReference?: string;
  statementLineId?: string;
}) {
  const statementLine = input.statementLineId
    ? await getBankStatementLine({ ...input, statementLineId: input.statementLineId })
    : undefined;
  const amount = input.amount ?? numberOf(statementLine, "amount");
  const searchText = input.payeeOrReference ?? `${stringOf(statementLine, "payee") ?? ""} ${stringOf(statementLine, "reference") ?? ""}`.trim();
  const transactions = await listBankTransactions({ bankAccountId: input.bankAccountId, fromDate: input.fromDate, toDate: input.toDate, page: 1, pageSize: 500 });
  const payments = await listPayments({ fromDate: input.fromDate, toDate: input.toDate, page: 1, pageSize: 500 });
  const normalizedSearch = searchText.toLowerCase();
  const candidates = [
    ...transactions.items.map((transaction) => ({
      matchType: "bank_transaction",
      id: transaction.bankTransactionID,
      date: stringOf(transaction, "date"),
      amount: numberOf(transaction, "total"),
      reference: stringOf(transaction, "reference"),
      reconciled: valueOf(transaction, "isReconciled"),
      score: matchScore(transaction, amount, normalizedSearch),
      entity: transaction,
    })),
    ...payments.items.map((payment) => ({
      matchType: "payment",
      id: payment.paymentID,
      date: stringOf(payment, "date"),
      amount: numberOf(payment, "amount"),
      reference: stringOf(payment, "reference"),
      reconciled: valueOf(payment, "isReconciled"),
      score: matchScore(payment, amount, normalizedSearch),
      entity: payment,
    })),
  ]
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  return {
    statementLine: statementLine ?? { amount: input.amount ?? null, payeeOrReference: input.payeeOrReference ?? null },
    candidates,
    reviewRequired: candidates.length !== 1 || candidates[0].score < 80,
    warnings: ["Candidate matching is advisory. This connector does not claim to reconcile the Xero statement line."] ,
  };
}

function matchScore(entity: JsonObject, amount: number | undefined, searchText: string): number {
  let score = 0;
  const entityAmount = numberOf(entity, "total") ?? numberOf(entity, "amount");
  if (amount !== undefined && entityAmount !== undefined) {
    if (Math.abs(amount - entityAmount) < 0.005) score += 60;
    else if (Math.abs(amount - entityAmount) <= 1) score += 20;
  }
  const reference = `${stringOf(entity, "reference") ?? ""} ${stringOf(valueOf(entity, "contact"), "name") ?? ""}`.toLowerCase();
  if (searchText && reference.includes(searchText)) score += 30;
  else if (searchText && searchText.split(/\s+/).some((part) => part.length > 2 && reference.includes(part))) score += 10;
  return score;
}

function publicContact(contact: JsonObject): JsonObject {
  const result = { ...contact };
  delete result.bankAccountDetails;
  delete result.taxNumber;
  delete result.contactPersons;
  return result;
}

export async function getContact(contactId: string): Promise<JsonObject> {
  const body = await accounting("getContact", [contactId], "GET /Contacts/{ContactID}");
  return publicContact(requireValue(arrayOf<JsonObject>(body, "contacts")[0], "Contact not found.", "GET /Contacts/{ContactID}"));
}

export async function createContact(contact: JsonObject, idempotencyKey?: string): Promise<JsonObject> {
  const body = await accounting("createContacts", [{ contacts: [contact] }, true, idempotencyKey], "POST /Contacts");
  const created = requireValue(arrayOf<JsonObject>(body, "contacts")[0], "Xero did not return the created contact.", "POST /Contacts");
  return publicContact(created);
}

export async function updateContact(contactId: string, patch: JsonObject, idempotencyKey?: string): Promise<JsonObject> {
  const body = await accounting("updateContact", [contactId, { contacts: [{ ...patch, contactID: contactId }] }, idempotencyKey], "POST /Contacts/{ContactID}");
  const updated = requireValue(arrayOf<JsonObject>(body, "contacts")[0], "Xero did not return the updated contact.", "POST /Contacts/{ContactID}");
  return publicContact(updated);
}

export async function archiveContact(contactId: string, idempotencyKey?: string): Promise<JsonObject> {
  return updateContact(contactId, { contactStatus: Contact.ContactStatusEnum.ARCHIVED }, idempotencyKey);
}

export async function restoreContact(contactId: string, idempotencyKey?: string): Promise<JsonObject> {
  return updateContact(contactId, { contactStatus: Contact.ContactStatusEnum.ACTIVE }, idempotencyKey);
}

export async function listContacts(input: { searchTerm?: string; includeArchived?: boolean; page?: number; pageSize?: number } = {}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const body = await accounting("getContacts", [undefined, undefined, "Name ASC", undefined, page, input.includeArchived ?? false, false, input.searchTerm, pageSize], "GET /Contacts");
  const items = arrayOf<JsonObject>(body, "contacts").map(publicContact);
  return { items, pagination: { page, pageSize, hasMore: items.length >= pageSize, ...(items.length >= pageSize ? { nextPage: page + 1 } : {}) } };
}

export async function listCurrencies(): Promise<JsonObject[]> {
  const body = await accounting("getCurrencies", [undefined, "Code ASC"], "GET /Currencies");
  return arrayOf<JsonObject>(body, "currencies");
}

export async function getOrganisation(): Promise<JsonObject> {
  const body = await accounting("getOrganisations", [], "GET /Organisations");
  return requireValue(arrayOf<JsonObject>(body, "organisations")[0], "Organisation details were not returned by Xero.", "GET /Organisations");
}

export type AttachmentParent = "invoice" | "bill" | "bank_transaction" | "bank_transfer" | "contact" | "account" | "manual_journal" | "credit_note" | "quote" | "receipt";

function attachmentMethod(parent: AttachmentParent, action: "list" | "upload" | "get"): string {
  const names: Record<AttachmentParent, { list: string; upload: string; get: string }> = {
    invoice: { list: "getInvoiceAttachments", upload: "createInvoiceAttachmentByFileName", get: "getInvoiceAttachmentById" },
    bill: { list: "getInvoiceAttachments", upload: "createInvoiceAttachmentByFileName", get: "getInvoiceAttachmentById" },
    bank_transaction: { list: "getBankTransactionAttachments", upload: "createBankTransactionAttachmentByFileName", get: "getBankTransactionAttachmentById" },
    bank_transfer: { list: "getBankTransferAttachments", upload: "createBankTransferAttachmentByFileName", get: "getBankTransferAttachmentById" },
    contact: { list: "getContactAttachments", upload: "createContactAttachmentByFileName", get: "getContactAttachmentById" },
    account: { list: "getAccountAttachments", upload: "createAccountAttachmentByFileName", get: "getAccountAttachmentById" },
    manual_journal: { list: "getManualJournalAttachments", upload: "createManualJournalAttachmentByFileName", get: "getManualJournalAttachmentById" },
    credit_note: { list: "getCreditNoteAttachments", upload: "createCreditNoteAttachmentByFileName", get: "getCreditNoteAttachmentById" },
    quote: { list: "getQuoteAttachments", upload: "createQuoteAttachmentByFileName", get: "getQuoteAttachmentById" },
    receipt: { list: "getReceiptAttachments", upload: "createReceiptAttachmentByFileName", get: "getReceiptAttachmentById" },
  };
  return names[parent][action];
}

export async function listAttachments(parent: AttachmentParent, parentId: string): Promise<JsonObject[]> {
  const body = await accounting(attachmentMethod(parent, "list"), [parentId], `GET /${parent}/Attachments`);
  return arrayOf<JsonObject>(body, "attachments");
}

export async function uploadAttachment(input: { parent: AttachmentParent; parentId: string; fileName: string; mimeType: string; contentBase64: string; includeOnline?: boolean; idempotencyKey?: string }): Promise<JsonObject> {
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (!bytes.length) throw new BookkeepingError("contentBase64 did not contain any file bytes.", "POST /Attachments", { status: 422 });
  if (bytes.length > 10 * 1024 * 1024) throw new BookkeepingError("Xero allows attachments up to 10 MB per file.", "POST /Attachments", { status: 413 });
  const args: unknown[] = [input.parentId, input.fileName, bytes];
  if (input.parent === "invoice" || input.parent === "bill" || input.parent === "credit_note") args.push(input.includeOnline ?? false);
  args.push(input.idempotencyKey);
  const body = await accounting(attachmentMethod(input.parent, "upload"), args, `POST /${input.parent}/Attachments/{fileName}`);
  const attachment = arrayOf<JsonObject>(body, "attachments")[0];
  return attachment ? { ...attachment, mimeType: attachment.mimeType ?? input.mimeType } : { fileName: input.fileName, mimeType: input.mimeType };
}

export async function getAttachment(parent: AttachmentParent, parentId: string, attachmentId: string, mimeType = "application/octet-stream"): Promise<JsonObject> {
  const body = await accounting(attachmentMethod(parent, "get"), [parentId, attachmentId, mimeType], `GET /${parent}/Attachments/{attachmentID}`);
  if (Buffer.isBuffer(body)) return { attachmentId, mimeType, contentBase64: body.toString("base64") };
  if (typeof body === "string") return { attachmentId, mimeType, contentBase64: Buffer.from(body).toString("base64") };
  return sanitizeErrorDetails(body) as JsonObject;
}

export async function deleteAttachment(): Promise<never> {
  throw new BookkeepingError(
    "Xero's Accounting API does not expose a delete attachment endpoint. Replace an attachment by uploading the same filename or remove it in Xero.",
    "DELETE /Attachments",
    { status: 405 },
  );
}

export type HistoryEntity = "bank_transaction" | "bank_transfer" | "contact" | "credit_note" | "invoice" | "manual_journal" | "payment" | "quote" | "item" | "purchase_order" | "repeating_invoice";

function historyMethod(entity: HistoryEntity): string {
  const methods: Record<HistoryEntity, string> = {
    bank_transaction: "getBankTransactionsHistory",
    bank_transfer: "getBankTransferHistory",
    contact: "getContactHistory",
    credit_note: "getCreditNoteHistory",
    invoice: "getInvoiceHistory",
    manual_journal: "getManualJournalsHistory",
    payment: "getPaymentHistory",
    quote: "getQuoteHistory",
    item: "getItemHistory",
    purchase_order: "getPurchaseOrderHistory",
    repeating_invoice: "getRepeatingInvoiceHistory",
  };
  return methods[entity];
}

function historyCreateMethod(entity: HistoryEntity): string {
  const methods: Record<HistoryEntity, string> = {
    bank_transaction: "createBankTransactionHistoryRecord",
    bank_transfer: "createBankTransferHistoryRecord",
    contact: "createContactHistory",
    credit_note: "createCreditNoteHistory",
    invoice: "createInvoiceHistory",
    manual_journal: "createManualJournalHistoryRecord",
    payment: "createPaymentHistory",
    quote: "createQuoteHistory",
    item: "createItemHistory",
    purchase_order: "createPurchaseOrderHistory",
    repeating_invoice: "createRepeatingInvoiceHistory",
  };
  return methods[entity];
}

export async function getHistory(entity: HistoryEntity, entityId: string): Promise<JsonObject[]> {
  const body = await accounting(historyMethod(entity), [entityId], `GET /${entity}/history`);
  return arrayOf<JsonObject>(body, "historyRecords");
}

export async function addHistoryNote(entity: HistoryEntity, entityId: string, details: string, idempotencyKey?: string): Promise<JsonObject[]> {
  const method = historyCreateMethod(entity);
  const body = await accounting(method, [entityId, { historyRecords: [{ details }] }, idempotencyKey], `POST /${entity}/history`);
  return arrayOf<JsonObject>(body, "historyRecords");
}

export async function listProjects(input: { projectIds?: string[]; contactId?: string; states?: string; page?: number; pageSize?: number } = {}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const body = await projects("getProjects", [input.projectIds, input.contactId, input.states, page, pageSize], "GET /Projects");
  const items = arrayOf<JsonObject>(body, "items");
  const pagination = isObject(body) && isObject(body.pagination) ? body.pagination : {};
  return { items, pagination: { page: numberOf(pagination, "page") ?? page, pageSize: numberOf(pagination, "pageSize") ?? pageSize, hasMore: (numberOf(pagination, "page") ?? page) < (numberOf(pagination, "pageCount") ?? page) } };
}

export async function getProject(projectId: string): Promise<JsonObject> {
  return projects("getProject", [projectId], "GET /Projects/{projectId}") as Promise<JsonObject>;
}

export async function createProject(input: { name: string; contactId?: string; estimateAmount?: number; deadlineUtc?: string; idempotencyKey?: string }): Promise<JsonObject> {
  return projects("createProject", [{ name: input.name, contactId: input.contactId, estimateAmount: input.estimateAmount, deadlineUtc: input.deadlineUtc ? new Date(input.deadlineUtc) : undefined }, input.idempotencyKey], "POST /Projects") as Promise<JsonObject>;
}

export async function updateProject(projectId: string, input: { name: string; contactId?: string; estimateAmount?: number; deadlineUtc?: string; idempotencyKey?: string }): Promise<JsonObject> {
  return projects("updateProject", [projectId, { name: input.name, contactId: input.contactId, estimateAmount: input.estimateAmount, deadlineUtc: input.deadlineUtc ? new Date(input.deadlineUtc) : undefined }, input.idempotencyKey], "PUT /Projects/{projectId}") as Promise<JsonObject>;
}

export async function listFixedAssets(input: { status?: string; page?: number; pageSize?: number; filterBy?: string } = {}) {
  const status = input.status ?? "REGISTERED";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const body = await assets("getAssets", [status, page, pageSize, "PurchaseDate", "desc", input.filterBy], "GET /Assets");
  const items = arrayOf<JsonObject>(body, "items");
  return { items, pagination: { page, pageSize, hasMore: items.length >= pageSize, ...(items.length >= pageSize ? { nextPage: page + 1 } : {}) } };
}

export async function getFixedAsset(assetId: string): Promise<JsonObject> {
  return assets("getAssetById", [assetId], "GET /Assets/{assetId}") as Promise<JsonObject>;
}

export async function createFixedAsset(input: JsonObject, idempotencyKey?: string): Promise<JsonObject> {
  await assertDateUnlocked(typeof input.purchaseDate === "string" ? input.purchaseDate : undefined);
  return assets("createAsset", [input, idempotencyKey], "POST /Assets") as Promise<JsonObject>;
}

export async function disposeFixedAsset(): Promise<never> {
  throw new BookkeepingError("The installed Xero Assets API SDK does not expose an asset disposal/update endpoint. Review and dispose the asset in Xero.", "Assets API", { status: 405 });
}

export async function listExpenseClaims(input: { fromDate?: string; toDate?: string; status?: string; page?: number } = {}): Promise<JsonObject[]> {
  const where = combineWhere([
    input.status ? `Status=="${quoteQueryValue(input.status)}"` : undefined,
    input.fromDate ? dateQuery("ReportingDate", input.fromDate, ">=") : undefined,
    input.toDate ? dateQuery("ReportingDate", input.toDate, "<=") : undefined,
  ]);
  const body = await accounting("getExpenseClaims", [undefined, where, "ReportingDate DESC"], "GET /ExpenseClaims");
  const claims = arrayOf<JsonObject>(body, "expenseClaims");
  const page = input.page ?? 1;
  return claims.slice((page - 1) * 100, page * 100);
}

export async function createReceipt(input: { contactId?: string; lineItems: JsonObject[]; date?: string; reference?: string; url?: string; idempotencyKey?: string }): Promise<JsonObject> {
  await assertDateUnlocked(input.date);
  const body = await accounting("createReceipt", [{ receipts: [{ contact: input.contactId ? { contactID: input.contactId } : undefined, lineItems: await resolvedLineItems(input.lineItems), date: input.date, reference: input.reference, url: input.url }] }, undefined, input.idempotencyKey], "POST /Receipts");
  return requireValue(arrayOf<JsonObject>(body, "receipts")[0], "Xero did not return the created receipt.", "POST /Receipts");
}
