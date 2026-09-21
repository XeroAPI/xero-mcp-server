# Conecta bookkeeping operations connector

## Summary

This branch extends the existing Xero MCP server into a mutation-capable bookkeeping connector for ChatGPT. Existing hyphenated tools remain registered. The new snake_case tools are split into account, transaction, reconciliation, report, document, and Conecta workflow modules, with a shared Xero adapter underneath.

## 1. Existing capability inventory

Before this branch, the server already handled OAuth/custom connections, accounts, contacts, invoices, credit notes, quotes, payments, manual journals, bank transactions, tracking reads, reports, and payroll tools. Most handlers returned text-only results and several write paths did not perform lock-date, duplicate, balance, or structured-error checks.

## 2. New tools and enhancements

- Chart of accounts and tracking category/option lifecycle.
- Rich bank transaction filters, get/update/void, bank transfers, and source references.
- Explicit bill, invoice, payment, and credit-note bookkeeping wrappers.
- Manual-journal tracking, balance validation, date/status filters, and source URLs.
- Finance bank statement lines, candidate matching, and explicit reconciliation handoffs.
- General ledger, journal, account activity, cash-flow, receivables/payables, budget, executive, bank, and tax report tools.
- Attachments, contacts, currencies, organisation settings, history notes, projects, receipts, expense claims, and fixed-asset primitives.
- Conecta workflows for shareholder contributions, waived commissions, founder runway, compensation, contractor payments, event expenses, event P&L, reconciliation review, and monthly close.

## 3. OAuth scope changes

`src/xero-oauth-scopes.ts` now advertises granular invoice/payment/bank/manual-journal/report scopes, `accounting.journals.read`, `accounting.attachments`, `accounting.budgets.read`, Finance read scopes, and optional `assets`/`projects` scopes. The same expanded set is used by the local Custom Connection defaults.

Existing ChatGPT connections must reconnect so Xero grants the new scopes. The structured tool error identifies missing-scope failures. Custom Connection users can override scopes with `XERO_SCOPES`.

## 4. Unsupported Xero capabilities

Xero's public Accounting API does not expose the final reconcile/unreconcile bank-statement mutation. The connector does not fake it. It exposes statement lines, candidate matching, prepared spend/receive-money transactions, and the IDs needed to finish in Xero Bank Rec. Bank-transfer delete/void, attachment delete, standalone currency-rate lookup, and the installed Assets disposal path return explicit unsupported responses.

## 5. Tracking-category bug root cause

The existing create tracking category and option handlers called the Xero SDK without first awaiting `xeroClient.authenticate()`. That left the request without a configured token/tenant in the hosted path. The handlers now authenticate before the write. The new shared tracking service also checks duplicates, resolves names or IDs, and returns the underlying Xero error details instead of hiding them.

## 6. Tests

Added tests for tracking serialization rules, balanced journals, shareholder safety rules, founder-runway/APIC separation, commission-liability review, contractor contact requirements, shared-adapter account reads, and Finance statement-line reads. The existing error-format tests remain in place.

## 7. Migration and backwards compatibility

No existing MCP tool was removed. Existing text responses remain available. New tools return JSON text plus structured content. The Vercel route continues to use the existing `/api/mcp` endpoint and bearer-token tenant selection. Reconnect ChatGPT after deploying this branch because the advertised OAuth scopes changed.

## 8. Example workflows

- Shareholder-paid event expense: `record_shareholder_paid_expense` → draft journal debit to the expense account and credit to 3201/3202/3203, with Event tracking and receipt URL.
- Cash capital contribution: `record_shareholder_cash_contribution` → Mercury receive-money, crediting the shareholder APIC account.
- Mercury event expense: `record_event_expense` with `payer: "company"` → spend-money with Event tracking.
- Founder runway funding: `record_founder_runway_funding` → Mercury receive-money with an explicit non-APIC classification.
- Alberto payment: `record_founder_compensation_payment` → spend-money using the configured compensation account and existing Alberto contact.
- RedDoor/Jimbo: `record_contractor_payment` → spend-money to the existing vendor contact, defaulting to 6090 Contract Labor and validating 40 × $7 = $280 when supplied.
- Monthly Mercury reconciliation: `reconcile_bank_account` with `dryRun: true` → statement lines, candidate matches, duplicate warnings, and manual Bank Rec handoff.
- Event P&L: `get_event_financial_summary` → Event-tracking-filtered P&L with attribution warnings.

Production was not redeployed from this branch.
