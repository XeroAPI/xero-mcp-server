import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ACCOUNTING_MUTATIONS = [
  "createBankTransactions",
  "createContacts",
  "createCreditNotes",
  "createInvoices",
  "createItems",
  "createManualJournals",
  "createPayment",
  "createQuotes",
  "createTrackingCategory",
  "updateBankTransaction",
  "updateContact",
  "updateCreditNote",
  "updateInvoice",
  "updateItem",
  "updateManualJournal",
  "updateQuote",
  "updateTrackingCategory",
] as const;

const FAN_OUT_ACCOUNTING_MUTATIONS = [
  "createTrackingOptions",
  "updateTrackingOptions",
] as const;

const PAYROLL_MUTATIONS = [
  "approveTimesheet",
  "createTimesheet",
  "createTimesheetLine",
  "revertTimesheet",
  "updateTimesheetLine",
] as const;

function handlerSource(method: string): string {
  const handlers = fileURLToPath(new URL("../../handlers/", import.meta.url));
  const files: Record<string, string> = {
    approveTimesheet: "approve-xero-payroll-timesheet.handler.ts",
    createBankTransactions: "create-xero-bank-transaction.handler.ts",
    createContacts: "create-xero-contact.handler.ts",
    createCreditNotes: "create-xero-credit-note.handler.ts",
    createInvoices: "create-xero-invoice.handler.ts",
    createItems: "create-xero-item.handler.ts",
    createManualJournals: "create-xero-manual-journal.handler.ts",
    createPayment: "create-xero-payment.handler.ts",
    createQuotes: "create-xero-quote.handler.ts",
    createTimesheet: "create-xero-payroll-timesheet.handler.ts",
    createTimesheetLine: "update-xero-payroll-timesheet-add-line.handler.ts",
    createTrackingCategory: "create-xero-tracking-category.handler.ts",
    createTrackingOptions: "create-xero-tracking-option.handler.ts",
    deleteTimesheet: "delete-xero-payroll-timesheet.handler.ts",
    revertTimesheet: "revert-xero-payroll-timesheet.handler.ts",
    updateBankTransaction: "update-xero-bank-transaction.handler.ts",
    updateContact: "update-xero-contact.handler.ts",
    updateCreditNote: "update-xero-credit-note.handler.ts",
    updateInvoice: "update-xero-invoice.handler.ts",
    updateItem: "update-xero-item.handler.ts",
    updateManualJournal: "update-xero-manual-journal.handler.ts",
    updateQuote: "update-xero-quote.handler.ts",
    updateTimesheetLine: "update-xero-payroll-timesheet-update-line.handler.ts",
    updateTrackingCategory: "update-xero-tracking-category.handler.ts",
    updateTrackingOptions: "update-xero-tracking-options.handler.ts",
  };
  return readFileSync(`${handlers}/${files[method]}`, "utf8");
}

describe("mutation idempotency coverage", () => {
  it("pins explicit support metadata on every registered mutation", () => {
    const tools = fileURLToPath(new URL("../../tools/", import.meta.url));
    const files = ["create", "update", "delete"].flatMap((directory) =>
      readdirSync(`${tools}/${directory}`)
        .filter((file) => file.endsWith("tool.ts"))
        .map((file) => `${tools}/${directory}/${file}`),
    );

    expect(files).toHaveLength(25);
    const supported: string[] = [];
    const unsupported: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("MutationXeroTool(");
      if (source.includes("supportsIdempotency: true")) supported.push(file);
      if (source.includes("supportsIdempotency: false")) unsupported.push(file);
    }
    expect(supported).toHaveLength(24);
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]).toMatch(/delete-payroll-timesheet\.tool\.ts$/);
  });

  it("keeps all registered read declarations free of mutation controls", () => {
    const tools = fileURLToPath(new URL("../../tools/", import.meta.url));
    const files = ["list", "get"].flatMap((directory) =>
      readdirSync(`${tools}/${directory}`)
        .filter((file) => file.endsWith("tool.ts"))
        .map((file) => `${tools}/${directory}/${file}`),
    );

    expect(files).toHaveLength(26);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("CreateXeroTool(");
      expect(source, file).not.toContain("MutationXeroTool(");
      expect(source, file).not.toContain("idempotencyKey");
      expect(source, file).not.toContain("confirmationAction");
    }
  });

  it.each(ACCOUNTING_MUTATIONS)("forwards a key to %s", (method) => {
    const source = handlerSource(method);
    const call = source.match(
      new RegExp(
        `accountingApi\\.${method}\\([\\s\\S]*?getClientHeaders\\(true\\)[\\s\\S]*?\\);`,
      ),
    );
    expect(call?.[0], method).toContain("getClientHeaders(true)");
  });

  it.each(FAN_OUT_ACCOUNTING_MUTATIONS)(
    "forwards per-item child keys to %s",
    (method) => {
      const source = handlerSource(method);
      const call = source.match(
        new RegExp(
          `accountingApi\\.${method}\\([\\s\\S]*?deriveChildIdempotencyKey\\([\\s\\S]*?getClientHeaders\\(\\)[\\s\\S]*?\\);`,
        ),
      );
      expect(call?.[0], method).toContain("deriveChildIdempotencyKey(");
    },
  );

  it.each(PAYROLL_MUTATIONS)("forwards a key to %s", (method) => {
    const source = handlerSource(method);
    const call = source.match(
      new RegExp(
        `payrollNZApi\\.${method}\\([\\s\\S]*?getCurrentIdempotencyKey\\(\\)[\\s\\S]*?\\);`,
      ),
    );
    expect(call?.[0], method).toContain("getCurrentIdempotencyKey()");
  });

  it("documents the SDK exception for deleteTimesheet", () => {
    const source = handlerSource("deleteTimesheet");
    expect(source).not.toContain("getCurrentIdempotencyKey");
  });
});
