import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {},
}));

import ListBankTransactionsTool from "./list/list-bank-transactions.tool.js";
import ListContactsTool from "./list/list-contacts.tool.js";
import ListCreditNotesTool from "./list/list-credit-notes.tool.js";
import ListInvoicesTool from "./list/list-invoices.tool.js";
import ListItemsTool from "./list/list-items.tool.js";
import ListManualJournalsTool from "./list/list-manual-journals.tool.js";
import ListPaymentsTool from "./list/list-payments.tool.js";
import ListQuotesTool from "./list/list-quotes.tool.js";

const getSchema = (tool: () => { schema: unknown }) =>
  z.object(tool().schema as z.ZodRawShape);

describe("list-tool pagination schemas", () => {
  it.each([
    ["bank transactions", ListBankTransactionsTool],
    ["credit notes", ListCreditNotesTool],
    ["invoices", ListInvoicesTool],
    ["items", ListItemsTool],
    ["quotes", ListQuotesTool],
  ])("accepts only positive integer pages for %s", (_name, tool) => {
    const schema = getSchema(tool);

    expect(schema.safeParse({ page: 1 }).success).toBe(true);
    expect(schema.safeParse({ page: 0 }).success).toBe(false);
    expect(schema.safeParse({ page: -1 }).success).toBe(false);
    expect(schema.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it.each([
    ["contacts", ListContactsTool],
    ["manual journals", ListManualJournalsTool],
  ])("allows an omitted page but rejects invalid pages for %s", (_name, tool) => {
    const schema = getSchema(tool);

    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ page: 0 }).success).toBe(false);
    expect(schema.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it("defaults payment pages to one and rejects invalid values", () => {
    const schema = getSchema(ListPaymentsTool);

    expect(schema.parse({}).page).toBe(1);
    expect(schema.safeParse({ page: 0 }).success).toBe(false);
    expect(schema.safeParse({ page: 1.5 }).success).toBe(false);
  });
});
