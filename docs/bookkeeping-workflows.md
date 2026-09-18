# Conecta bookkeeping workflows

The high-level tools encode Conecta's known rules and stop for review when the accounting treatment is not configured.

## Shareholder-paid event expense

Use `record_shareholder_paid_expense` with the shareholder, expense account code, amount, date, receipt URL, and Event option name. With `countsTowardCommitment: true`, the connector prepares a draft manual journal:

```text
Debit  expense account                  amount
Credit 3201 Jess APIC                   amount
```

Ernie maps to 3202 and Alberto maps to 3203. Jess's known commitment is $25,000. The tool does not post a non-capital liability treatment without an explicit configured workflow.

## Cash capital contribution

Use `record_shareholder_cash_contribution`. It creates a receive-money transaction into the selected bank account and credits that shareholder's APIC account. It does not classify cash as revenue.

## Event expense paid from Mercury

Use `record_event_expense` with `payer: "company"`, a Mercury bank account ID, the expense account, and the exact Event option. The line item receives Event tracking. Missing event options are a review-required error; the tool does not create them implicitly.

## Founder runway funding

Use `record_founder_runway_funding` only after the classification account has been configured. The tool refuses APIC accounts 3201/3202/3203 because founder runway is separate from shareholder capital. Jess's expected funding is $3,000 per month and Ernie's is $1,000 per month for the six-month plan beginning October 2026, but the tool does not force those amounts.

## Payment to Alberto

Use `record_founder_compensation_payment` with an existing Alberto contact and the configured expense account. The tool refuses to choose payroll, officer compensation, or another tax treatment itself.

## RedDoor/Jimbo payment

Use `record_contractor_payment` with the existing RedDoor/Jimbo contact. The default expense account is 6090 Contract Labor. If hours and rate are supplied, the tool checks the amount: 40 hours × $7/hour = $280 for the normal weekly payment.

## Mercury reconciliation

Use `reconcile_bank_account` with `dryRun: true` first. It loads statement lines and candidate Xero transactions, reports high-confidence matches and duplicates, and returns ambiguous items for review. The public Xero API does not expose the final Bank Rec mutation, so completion remains in Xero.

## Event P&L

Use `get_event_financial_summary` after Event tracking exists. It resolves the Event option and calls the tracking-filtered P&L report. Revenue and costs are only attributed when the source transaction was tagged; the response includes that warning.

## Monthly close

Use `monthly_close_checklist` for a read-only review. It checks statement lines, drafts, overdue receivables, duplicate-looking transactions, missing tracking, missing attachments, suspense/shareholder balances, lock-date context, and open journals. It never mutates Xero.
