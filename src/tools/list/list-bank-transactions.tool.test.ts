import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../handlers/list-xero-bank-transactions.handler.js", () => ({
  listXeroBankTransactions: vi.fn(),
}));

import ListBankTransactionsTool from "./list-bank-transactions.tool.js";

describe("list-bank-transactions", () => {
  it("requires a UUID-shaped bank account filter", () => {
    const tool = ListBankTransactionsTool();
    const schema = z.object(tool.schema as z.ZodRawShape);

    expect(schema.safeParse({
      page: 1,
      bankAccountId: "123e4567-e89b-12d3-a456-426614174000",
    }).success).toBe(true);
    expect(schema.safeParse({
      page: 1,
      bankAccountId: '123e4567-e89b-12d3-a456-426614174000") OR Status=="AUTHORISED',
    }).success).toBe(false);
    expect(tool.description).toContain("next page of bank transactions");
    expect(tool.description).not.toContain("next page of quotes");
  });
});
