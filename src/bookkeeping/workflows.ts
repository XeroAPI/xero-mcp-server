import * as accounts from "./accounts.js";
import * as reconciliation from "./reconciliation.js";
import * as reports from "./reports.js";
import * as transactions from "./transactions.js";
import { BookkeepingError } from "./service.js";

type JsonObject = Record<string, unknown>;

const shareholderAccounts = {
  jess: { displayName: "Jess Corrick", accountCode: "3201", commitment: 25000 },
  ernie: { displayName: "Ernie Cintron", accountCode: "3202", commitment: undefined },
  alberto: { displayName: "Alberto Contreras", accountCode: "3203", commitment: undefined },
} as const;

function shareholderConfig(shareholder: string) {
  const normalized = shareholder.toLowerCase().replace(/\s+/g, "_") as keyof typeof shareholderAccounts;
  const config = shareholderAccounts[normalized];
  if (!config) throw new BookkeepingError("Shareholder must be Jess, Ernie, or Alberto.", "Conecta bookkeeping workflow", { status: 422 });
  return { key: normalized, ...config };
}

async function requireAccountCode(accountCode: string): Promise<JsonObject> {
  const account = (await accounts.listAccounts(true)).find((candidate) => candidate.code === accountCode);
  if (!account) throw new BookkeepingError(`Account code ${accountCode} was not found. No transaction was posted.`, "GET /Accounts", { status: 422, details: { accountCode } });
  return account;
}

async function eventTracking(event?: string): Promise<JsonObject[] | undefined> {
  if (!event) return undefined;
  const category = (await accounts.listTrackingCategories(false)).find((candidate) => candidate.name === "Event");
  const option = category && Array.isArray(category.options)
    ? (category.options as JsonObject[]).find((candidate) => candidate.name === event)
    : undefined;
  if (!category || !option) {
    throw new BookkeepingError(`Event tracking option ${event} was not found under the Event category.`, "GET /TrackingCategories", { status: 422, details: { category: "Event", option: event } });
  }
  return [{ trackingCategoryID: category.trackingCategoryID, name: category.name, trackingOptionID: option.trackingOptionID, option: option.name }];
}

export async function recordShareholderPaidExpense(input: {
  shareholder: string;
  amount: number;
  expenseAccountCode: string;
  date: string;
  vendorContactId?: string;
  description: string;
  event?: string;
  sourceUrl?: string;
  countsTowardCommitment: boolean;
  reference?: string;
  idempotencyKey?: string;
}) {
  const shareholderConfigValue = shareholderConfig(input.shareholder);
  if (!input.countsTowardCommitment) {
    return {
      reviewRequired: true,
      mutated: false,
      reason: "This workflow only posts shareholder-paid expenses to APIC when countsTowardCommitment=true. Supply the configured non-capital liability treatment before posting another classification.",
    };
  }
  await requireAccountCode(input.expenseAccountCode);
  await requireAccountCode(shareholderConfigValue.accountCode);
  const tracking = await eventTracking(input.event);
  const journal = await transactions.createManualJournal({
    narration: `SHAREHOLDER_EXPENSE:${shareholderConfigValue.key}:${input.reference ?? input.description}`,
    date: input.date,
    status: "DRAFT",
    url: input.sourceUrl,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { lineAmount: input.amount, accountCode: input.expenseAccountCode, description: input.description, tracking },
      { lineAmount: -input.amount, accountCode: shareholderConfigValue.accountCode, description: `Capital credit for ${shareholderConfigValue.displayName}${input.reference ? ` (${input.reference})` : ""}` },
    ],
  });
  return {
    mutated: true,
    journal,
    accountingEntry: { debit: { accountCode: input.expenseAccountCode, amount: input.amount }, credit: { accountCode: shareholderConfigValue.accountCode, amount: input.amount } },
    contributionEffect: { shareholder: shareholderConfigValue.displayName, amount: input.amount, countsTowardCommitment: true },
    vendorContactId: input.vendorContactId ?? null,
  };
}

export async function recordShareholderCashContribution(input: { shareholder: string; amount: number; bankAccountId: string; date: string; reference?: string; contributionType?: string; idempotencyKey?: string }) {
  const shareholderConfigValue = shareholderConfig(input.shareholder);
  await requireAccountCode(shareholderConfigValue.accountCode);
  const transaction = await transactions.createBankTransaction({
    type: "RECEIVE",
    bankAccountId: input.bankAccountId,
    date: input.date,
    reference: `CAPITAL_CONTRIBUTION:${shareholderConfigValue.key}:${input.reference ?? ""}`,
    idempotencyKey: input.idempotencyKey,
    lineItems: [{ description: input.contributionType ?? `Cash contribution from ${shareholderConfigValue.displayName}`, quantity: 1, unitAmount: input.amount, lineAmount: input.amount, accountCode: shareholderConfigValue.accountCode, taxType: "NONE" }],
  });
  return {
    transaction,
    accountingEntry: { debit: { accountId: input.bankAccountId, amount: input.amount }, credit: { accountCode: shareholderConfigValue.accountCode, amount: input.amount } },
    contributionEffect: { shareholder: shareholderConfigValue.displayName, amount: input.amount, type: "cash" },
  };
}

export async function getShareholderContributionSummary() {
  const journals: JsonObject[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore && offset < 10000) {
    const page = await reconciliation.listJournals({ offset, pageSize: 100 });
    journals.push(...page.items);
    hasMore = page.pagination.hasMore;
    offset = page.pagination.nextOffset ?? offset + page.items.length;
    if (!page.items.length) break;
  }
  return Object.entries(shareholderAccounts).map(([key, config]) => {
    let expensesPaidPersonally = 0;
    let waivedCommissions = 0;
    let cashContributions = 0;
    let otherCapitalCredits = 0;
    for (const journal of journals) {
      const narration = String(journal.narration ?? "");
      const lines = Array.isArray(journal.journalLines) ? (journal.journalLines as JsonObject[]) : [];
      for (const line of lines) {
        if (line.accountCode !== config.accountCode) continue;
        const credit = Math.max(-Number(line.netAmount ?? line.lineAmount ?? 0), 0);
        if (!credit) continue;
        if (narration.startsWith(`SHAREHOLDER_EXPENSE:${key}:`)) expensesPaidPersonally += credit;
        else if (narration.startsWith(`WAIVED_COMMISSION:${key}:`)) waivedCommissions += credit;
        else if (narration.startsWith(`CAPITAL_CONTRIBUTION:${key}:`)) cashContributions += credit;
        else otherCapitalCredits += credit;
      }
    }
    const totalCredited = expensesPaidPersonally + waivedCommissions + cashContributions + otherCapitalCredits;
    return {
      shareholder: config.displayName,
      accountCode: config.accountCode,
      cashContributions,
      expensesPaidPersonally,
      waivedCommissions,
      otherCapitalCredits,
      totalCredited,
      knownCommitment: config.commitment ?? null,
      remainingCommitment: config.commitment === undefined ? null : Math.max(config.commitment - totalCredited, 0),
      warning: config.commitment === undefined ? "No commitment is configured for this shareholder." : null,
    };
  });
}

export async function recordWaivedCommissionAsCapital(input: { shareholder: string; amount: number; date: string; saleReference: string; commissionLiabilityAccountCode?: string; description?: string; idempotencyKey?: string }) {
  const config = shareholderConfig(input.shareholder);
  if (!input.commissionLiabilityAccountCode) return { mutated: false, reviewRequired: true, reason: "Provide the account code for the already-accrued commission liability so the workflow can verify it before reversing it." };
  await requireAccountCode(config.accountCode);
  await requireAccountCode(input.commissionLiabilityAccountCode);
  const journals = await reconciliation.listJournals({ accountCode: input.commissionLiabilityAccountCode, pageSize: 500 });
  const priorAccrual = journals.items.some((journal) => {
    const text = `${journal.narration ?? ""} ${journal.reference ?? ""} ${JSON.stringify(journal.journalLines ?? [])}`.toLowerCase();
    return text.includes(input.saleReference.toLowerCase()) && (journal.journalLines as JsonObject[] | undefined)?.some((line) => Number(line.netAmount ?? 0) < 0);
  });
  if (!priorAccrual) return { mutated: false, reviewRequired: true, reason: "No prior accrued commission liability matching the sale reference was found. No fake expense or capital entry was created." };
  const journal = await transactions.createManualJournal({
    narration: `WAIVED_COMMISSION:${config.key}:${input.saleReference}`,
    date: input.date,
    status: "DRAFT",
    idempotencyKey: input.idempotencyKey,
    lines: [
      { lineAmount: input.amount, accountCode: input.commissionLiabilityAccountCode, description: input.description ?? `Reverse waived commission for ${input.saleReference}` },
      { lineAmount: -input.amount, accountCode: config.accountCode, description: `Capital credit for ${config.displayName}` },
    ],
  });
  return { mutated: true, journal, accountingEntry: { debit: { accountCode: input.commissionLiabilityAccountCode, amount: input.amount }, credit: { accountCode: config.accountCode, amount: input.amount } } };
}

export async function recordFounderRunwayFunding(input: { shareholder: string; amount: number; date: string; mercuryBankAccountId: string; month: string; classificationAccountCode?: string; classification?: string; idempotencyKey?: string }) {
  const config = shareholderConfig(input.shareholder);
  if (!input.classificationAccountCode) return { mutated: false, reviewRequired: true, reason: "Founder runway is not automatically classified as APIC. Supply the configured receiving liability/equity account and classification after accounting review." };
  if (["3201", "3202", "3203"].includes(input.classificationAccountCode)) return { mutated: false, reviewRequired: true, reason: "Founder runway must remain separate from shareholder capital. Choose the configured runway funding account, not an APIC account." };
  await requireAccountCode(input.classificationAccountCode);
  const transaction = await transactions.createBankTransaction({
    type: "RECEIVE",
    bankAccountId: input.mercuryBankAccountId,
    date: input.date,
    reference: `FOUNDER_RUNWAY:${config.key}:${input.month}`,
    idempotencyKey: input.idempotencyKey,
    lineItems: [{ description: `${config.displayName} founder runway funding for ${input.month}`, quantity: 1, unitAmount: input.amount, lineAmount: input.amount, accountCode: input.classificationAccountCode, taxType: "NONE" }],
  });
  return { mutated: true, transaction, classification: input.classification ?? "configured", warning: "Founder runway was posted to the explicitly supplied classification account; it was not posted to APIC." };
}

export async function recordFounderCompensationPayment(input: { amount: number; date: string; recipient: string; recipientContactId?: string; bankAccountId: string; month: string; expenseAccountCode?: string; idempotencyKey?: string }) {
  if (!input.expenseAccountCode || !input.recipientContactId) return { mutated: false, reviewRequired: true, reason: "Provide the configured compensation expense account and existing recipient contact. The workflow will not invent payroll or compensation treatment." };
  await requireAccountCode(input.expenseAccountCode);
  const transaction = await transactions.createBankTransaction({ type: "SPEND", bankAccountId: input.bankAccountId, contactId: input.recipientContactId, date: input.date, reference: `FOUNDER_COMPENSATION:${input.month}`, idempotencyKey: input.idempotencyKey, lineItems: [{ description: `${input.recipient} founder compensation for ${input.month}`, quantity: 1, unitAmount: input.amount, lineAmount: input.amount, accountCode: input.expenseAccountCode, taxType: "NONE" }] });
  return { mutated: true, transaction, warning: "Payroll vs officer compensation treatment was supplied through the configured expense account; verify tax/payroll treatment separately." };
}

export async function recordContractorPayment(input: { vendor: string; vendorContactId?: string; amount?: number; date: string; bankAccountId: string; expenseAccountCode?: string; reference?: string; period?: string; hours?: number; rate?: number; idempotencyKey?: string }) {
  if (!input.vendorContactId) return { mutated: false, reviewRequired: true, reason: "Provide the existing RedDoor/vendor contact ID. The workflow will not create a contact implicitly." };
  const expenseAccountCode = input.expenseAccountCode ?? "6090";
  await requireAccountCode(expenseAccountCode);
  const calculated = input.hours !== undefined && input.rate !== undefined ? input.hours * input.rate : undefined;
  if (input.amount !== undefined && calculated !== undefined && Math.abs(input.amount - calculated) > 0.005) throw new BookkeepingError("Amount does not equal hours × rate.", "Conecta contractor workflow", { status: 422, details: { amount: input.amount, calculated } });
  const amount = input.amount ?? calculated;
  if (amount === undefined) throw new BookkeepingError("Provide amount or both hours and rate.", "Conecta contractor workflow", { status: 422 });
  const transaction = await transactions.createBankTransaction({ type: "SPEND", bankAccountId: input.bankAccountId, contactId: input.vendorContactId, date: input.date, reference: input.reference ?? `CONTRACTOR:${input.vendor}:${input.period ?? ""}`, idempotencyKey: input.idempotencyKey, lineItems: [{ description: `${input.vendor}${input.period ? ` - ${input.period}` : ""}`, quantity: input.hours ?? 1, unitAmount: input.rate ?? amount, lineAmount: amount, accountCode: expenseAccountCode, taxType: "NONE" }] });
  return { mutated: true, transaction, calculation: { amount, hours: input.hours ?? null, rate: input.rate ?? null, defaultRate: input.vendor.toLowerCase().includes("jimbo") ? 7 : null, defaultHours: input.vendor.toLowerCase().includes("jimbo") ? 40 : null } };
}

export async function recordEventExpense(input: { event: string; payer: "company" | "shareholder"; shareholder?: string; amount: number; vendorContactId?: string; date: string; expenseAccountCode: string; bankAccountId?: string; description: string; sourceUrl?: string; countsTowardCommitment?: boolean; reference?: string; idempotencyKey?: string }) {
  const tracking = await eventTracking(input.event);
  if (input.payer === "shareholder") {
    if (!input.shareholder) return { mutated: false, reviewRequired: true, reason: "Shareholder payer requires shareholder." };
    return recordShareholderPaidExpense({ shareholder: input.shareholder, amount: input.amount, expenseAccountCode: input.expenseAccountCode, date: input.date, vendorContactId: input.vendorContactId, description: input.description, event: input.event, sourceUrl: input.sourceUrl, countsTowardCommitment: input.countsTowardCommitment ?? true, reference: input.reference, idempotencyKey: input.idempotencyKey });
  }
  if (!input.bankAccountId) return { mutated: false, reviewRequired: true, reason: "Company-paid event expenses require a bank account ID." };
  await requireAccountCode(input.expenseAccountCode);
  const transaction = await transactions.createBankTransaction({ type: "SPEND", bankAccountId: input.bankAccountId, contactId: input.vendorContactId, date: input.date, reference: input.reference ?? `EVENT_EXPENSE:${input.event}`, sourceUrl: input.sourceUrl, idempotencyKey: input.idempotencyKey, lineItems: [{ description: input.description, quantity: 1, unitAmount: input.amount, lineAmount: input.amount, accountCode: input.expenseAccountCode, taxType: "NONE", tracking }] });
  return { mutated: true, transaction, event: input.event, payer: "company" };
}

export async function getEventFinancialSummary(input: { event: string; fromDate?: string; toDate?: string }) {
  const tracking = await eventTracking(input.event);
  const eventOptionId = tracking?.[0]?.trackingOptionID;
  const report = await reports.reportProfitAndLoss({ fromDate: input.fromDate, toDate: input.toDate, trackingOptionId: typeof eventOptionId === "string" ? eventOptionId : undefined, standardLayout: true });
  return { event: input.event, fromDate: input.fromDate ?? null, toDate: input.toDate ?? null, report, attribution: { trackingCategory: "Event", trackingOption: input.event, trackingOptionId: eventOptionId ?? null }, warning: "Revenue and expense totals are returned from Xero's tracking-filtered P&L. Shareholder-paid/company-paid splits require the source transactions to use the event tracking option." };
}

export async function monthlyCloseChecklist(input: { monthStart: string; monthEnd: string; bankAccountId?: string }) {
  const [bank, bills, receivables, journals, chart, creditNotes] = await Promise.all([
    input.bankAccountId ? transactions.listBankTransactions({ bankAccountId: input.bankAccountId, fromDate: input.monthStart, toDate: input.monthEnd, page: 1, pageSize: 100 }) : Promise.resolve(null),
    transactions.listInvoices({ type: "ACCPAY", fromDate: input.monthStart, toDate: input.monthEnd, page: 1, pageSize: 100 }),
    transactions.listInvoices({ type: "ACCREC", fromDate: input.monthStart, toDate: input.monthEnd, page: 1, pageSize: 100 }),
    transactions.listManualJournals({ fromDate: input.monthStart, toDate: input.monthEnd, page: 1, pageSize: 100 }),
    accounts.listAccounts(true),
    transactions.listCreditNotes({ fromDate: input.monthStart, toDate: input.monthEnd, page: 1, pageSize: 100 }),
  ]);
  const shareholderJournals = journals.items.filter((journal) => String(journal.narration ?? "").includes("SHAREHOLDER_EXPENSE:"));
  const eventTransactions = bank?.items.filter((transaction) => String(transaction.reference ?? "").includes("EVENT")) ?? [];
  const uncategorizedTransactions = bank?.items.filter((transaction) => !Array.isArray(transaction.lineItems) || (transaction.lineItems as JsonObject[]).some((line) => !line.accountCode)) ?? [];
  const suspenseAccounts = chart.filter((account) => /suspense/i.test(String(account.name ?? "")));
  const shareholderBalanceAccounts = chart.filter((account) => /due\s*(to|from)|shareholder/i.test(String(account.name ?? "")));
  const checks: Array<Record<string, unknown>> = [
    { check: "unreconciled_bank_lines", status: bank ? "needs_review" : "blocked", detail: bank ? "Statement line reconciliation is not exposed as an API mutation; use statement tools and finish in Xero Bank Rec." : "Provide bankAccountId and Finance API access.", recommendedAction: "Run reconcile_bank_account, review candidates, and finish the match in Xero." },
    { check: "uncategorized_transactions", status: uncategorizedTransactions.length ? "needs_review" : "completed", count: uncategorizedTransactions.length, recommendedAction: uncategorizedTransactions.length ? "Assign an account to each line before close." : "No uncategorized bank transaction lines were returned." },
    { check: "draft_bills", status: bills.items.some((bill) => bill.status === "DRAFT") ? "needs_review" : "completed", count: bills.items.filter((bill) => bill.status === "DRAFT").length, recommendedAction: "Approve or delete draft bills after review." },
    { check: "unpaid_bills", status: bills.items.some((bill) => Number(bill.amountDue ?? 0) > 0) ? "needs_review" : "completed", count: bills.items.filter((bill) => Number(bill.amountDue ?? 0) > 0).length, recommendedAction: "Review payment timing and outstanding vendor balances." },
    { check: "overdue_or_unpaid_receivables", status: receivables.items.some((invoice) => Number(invoice.amountDue ?? 0) > 0) ? "needs_review" : "completed", count: receivables.items.filter((invoice) => Number(invoice.amountDue ?? 0) > 0).length, recommendedAction: "Review overdue customer balances and collections." },
    { check: "duplicate_detection", status: "needs_review", detail: "The close checklist cannot safely decide ambiguous duplicates.", recommendedAction: "Run find_reconciliation_candidates for each suspicious statement line." },
    { check: "shareholder_paid_expenses", status: shareholderJournals.length ? "needs_review" : "completed", count: shareholderJournals.length, recommendedAction: "Confirm every shareholder-paid expense has approval, receipt, and the correct APIC or liability treatment." },
    { check: "event_tracking", status: eventTransactions.length ? "needs_review" : "completed", count: eventTransactions.length, recommendedAction: "Inspect event transactions and add Event tracking before reporting event profitability." },
    { check: "suspense_balance", status: suspenseAccounts.length ? "needs_review" : "completed", accounts: suspenseAccounts.map((account) => ({ code: account.code, name: account.name })), recommendedAction: "Run general_ledger for each Suspense account and clear unexplained balances." },
    { check: "due_to_from_shareholders", status: shareholderBalanceAccounts.length ? "needs_review" : "completed", accounts: shareholderBalanceAccounts.map((account) => ({ code: account.code, name: account.name })), recommendedAction: "Run account_activity for shareholder Due To/From accounts and confirm the balances." },
    { check: "unusual_negative_balances", status: "needs_review", detail: "Account balances are not safely inferred from the limited transaction response.", recommendedAction: "Review the trial balance and general ledger for unexpected negative balances." },
    { check: "bank_balances_vs_statements", status: input.bankAccountId ? "needs_review" : "blocked", recommendedAction: "Compare the statement ending balance to Xero after completing Bank Rec." },
    { check: "missing_attachments", status: "needs_review", detail: "Xero does not provide one close endpoint that proves every source document is attached.", recommendedAction: "List attachments for material bills, bank transactions, and shareholder-paid expenses." },
    { check: "period_boundary", status: "completed", detail: "All loaded transaction queries were constrained to the requested month.", recommendedAction: "Review unusual dates before posting any backdated correction." },
    { check: "open_manual_journals", status: journals.items.some((journal) => journal.status === "DRAFT") ? "needs_review" : "completed", count: journals.items.filter((journal) => journal.status === "DRAFT").length, recommendedAction: "Approve, correct, or remove draft journals before close." },
    { check: "unallocated_credit_notes", status: creditNotes.items.some((note) => Number(note.remainingCredit ?? 0) > 0) ? "needs_review" : "completed", count: creditNotes.items.filter((note) => Number(note.remainingCredit ?? 0) > 0).length, recommendedAction: "Allocate or review remaining credit-note balances." },
    { check: "tax_settings", status: "completed", detail: "Tax settings are available through get_organisation_settings and transaction responses.", recommendedAction: "Review tax treatment on unusual or cross-border transactions." },
    { check: "contribution_ledgers", status: shareholderJournals.length ? "needs_review" : "completed", recommendedAction: "Run get_shareholder_contribution_summary and verify the APIC ledgers against source documents." },
    { check: "lock_dates", status: "completed", detail: "Mutation tools read lock dates before posting.", recommendedAction: "Do not backdate a correction through a locked period." },
  ];
  return { monthStart: input.monthStart, monthEnd: input.monthEnd, mutated: false, checks, overall: checks.some((check) => check.status === "blocked") ? "blocked" : checks.some((check) => check.status === "needs_review") ? "needs_review" : "completed" };
}

export async function reconcileBankAccount(input: { bankAccountId: string; fromDate: string; toDate: string; dryRun: boolean; pageSize?: number }) {
  const statement = await reconciliation.listBankStatementLines({ bankAccountId: input.bankAccountId, fromDate: input.fromDate, toDate: input.toDate, page: 1, pageSize: input.pageSize ?? 100 });
  const candidates = [];
  for (const line of statement.items) {
    if (typeof line.statementLineId !== "string") continue;
    candidates.push(await reconciliation.findReconciliationCandidates({ bankAccountId: input.bankAccountId, fromDate: input.fromDate, toDate: input.toDate, statementLineId: line.statementLineId }));
  }
  return { dryRun: input.dryRun, mutated: false, statement, candidates, reviewRequired: true, limitation: "Xero does not expose public reconcile/unreconcile mutations. No transaction was created or changed." };
}
