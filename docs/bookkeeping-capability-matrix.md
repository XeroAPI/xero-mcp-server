# Bookkeeping capability matrix

The connector keeps the existing Xero tool names and adds a bookkeeping namespace of raw operations plus Conecta workflows. The raw operations share one Xero adapter, so duplicate checks, lock-date checks, tracking resolution, balanced-journal validation, pagination, and structured errors are applied consistently.

| Area | Status | Notes |
| --- | --- | --- |
| Chart of accounts | Added | Create, read, update, archive, restore, list; account-code duplicate protection. |
| Tracking categories/options | Added | Full create/read/update/archive lifecycle; names or IDs are accepted on transaction lines. |
| Bank transactions | Enhanced | Rich filters, get/create/update/void, line tracking, source URL, idempotency key. |
| Bank transfers | Added | Create/read/list. Delete/void returns an explicit unsupported response. |
| Bills and invoices | Added | Bookkeeping wrappers over ACCPAY/ACCREC invoice APIs, approvals, voids, draft deletion, unpaid filters, payments. |
| Payments and credit notes | Added | Read/list/create/delete payment, credit-note read/list/allocation, tracking-capable line schemas. |
| Manual journals | Enhanced | Tracking, source URL, date/status filtering, lock-date checks, duplicate protection, and mandatory balance validation. |
| Bank statement lines | Added | Read and candidate matching through the Finance API when the tenant/token exposes it. |
| Reconciliation mutation | Unsupported by public API | The connector returns candidates and the exact IDs needed for Xero Bank Rec; it never pretends to reconcile or unreconcile a line. |
| General ledger | Added | Journals plus bookkeeping-friendly general-ledger/account-activity tools. Running balance is explicitly marked as returned-period only. |
| Reports | Enhanced | P&L, balance sheet, trial balance, aged receivables/payables, cash flow, bank, budget, executive, tax, GL aliases. |
| Attachments | Added | Upload/list/get with base64 file content and 10 MB guard; delete returns the API limitation. |
| Contacts/vendors | Enhanced | Create/read/update/archive/restore/list with sensitive banking/tax fields omitted from tool output. |
| History/audit notes | Added | Read history and add history notes for SDK-supported entity types. |
| Projects/events | Added | Xero Projects plus Event tracking wrappers and event P&L. |
| Expense claims/receipts | Partial | Expense-claim read and receipt creation are exposed; shareholder-paid expenses default to the safer manual-journal workflow. |
| Fixed assets | Partial | List/read/create are exposed when the Assets scope/API is enabled; disposal is returned as unsupported because the installed SDK/API path has no safe disposal operation. |
| Currency rates | Unsupported as standalone lookup | Transaction currency rates remain available on transaction responses. |

## OAuth scopes and reconnect

The hosted ChatGPT connector advertises the scopes in `src/xero-oauth-scopes.ts`. The new bookkeeping surface adds granular report scopes, `accounting.journals.read`, `accounting.attachments`, `accounting.budgets.read`, Finance read scopes for statement/activity data, and `assets`/`projects` where those APIs are used.

Existing ChatGPT connections must be disconnected and reconnected after these scope changes. A token that was granted before the new scopes will otherwise produce a structured missing-scope error. Custom Connection users should set `XERO_SCOPES` explicitly for the scopes supported by their connection; the hosted ChatGPT flow uses the Web/Auth Code token supplied by ChatGPT.

Xero's public Accounting API does not expose the final reconcile/unreconcile action for bank statement lines. That is why those tools return `supported: false`, candidates, and a manual handoff instead of inventing a mutation.
