import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ZodRawShape, z } from "zod";

const originalBearerToken = process.env.XERO_CLIENT_BEARER_TOKEN;

let bankTransactionsSchema: z.ZodObject<ZodRawShape>;
let creditNotesSchema: z.ZodObject<ZodRawShape>;
let invoicesSchema: z.ZodObject<ZodRawShape>;
let quotesSchema: z.ZodObject<ZodRawShape>;

beforeAll(async () => {
  process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";

  const [
    { default: ListBankTransactionsTool },
    { default: ListCreditNotesTool },
    { default: ListInvoicesTool },
    { default: ListQuotesTool },
  ] = await Promise.all([
    import("../list-bank-transactions.tool.js"),
    import("../list-credit-notes.tool.js"),
    import("../list-invoices.tool.js"),
    import("../list-quotes.tool.js"),
  ]);

  bankTransactionsSchema = z.object(
    ListBankTransactionsTool().schema as ZodRawShape,
  );
  creditNotesSchema = z.object(ListCreditNotesTool().schema as ZodRawShape);
  invoicesSchema = z.object(ListInvoicesTool().schema as ZodRawShape);
  quotesSchema = z.object(ListQuotesTool().schema as ZodRawShape);
});

afterAll(() => {
  if (originalBearerToken === undefined) {
    delete process.env.XERO_CLIENT_BEARER_TOKEN;
  } else {
    process.env.XERO_CLIENT_BEARER_TOKEN = originalBearerToken;
  }
});

describe("paginated list tools", () => {
  it("defaults bank transactions to the first page", () => {
    expect(bankTransactionsSchema.parse({})).toEqual({ page: 1 });
  });

  it("defaults credit notes to the first page", () => {
    expect(creditNotesSchema.parse({})).toEqual({ page: 1 });
  });

  it("defaults invoices to the first page", () => {
    expect(invoicesSchema.parse({})).toEqual({ page: 1 });
  });

  it("defaults quotes to the first page", () => {
    expect(quotesSchema.parse({})).toEqual({ page: 1 });
  });
});
