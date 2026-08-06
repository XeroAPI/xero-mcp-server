import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("../handlers/create-xero-bank-transaction.handler.js", () => ({
  createXeroBankTransaction: vi.fn(),
}));

vi.mock("../handlers/update-xero-bank-transaction.handler.js", () => ({
  updateXeroBankTransaction: vi.fn(),
}));

import CreateBankTransactionTool from "./create/create-bank-transaction.tool.js";
import UpdateBankTransactionTool from "./update/update-bank-transaction.tool.js";

describe("bank transaction validation", () => {
  it("accepts a contact-free description-only transaction", () => {
    const schema = z.object(CreateBankTransactionTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      type: "SPEND",
      bankAccountId: "bank-account-id",
      lineItems: [{ description: "Bank fee" }],
    }).success).toBe(true);
  });

  it("accepts a minimal line item when updating a transaction", () => {
    const schema = z.object(UpdateBankTransactionTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      bankTransactionId: "bank-transaction-id",
      lineItems: [{ itemCode: "FEE" }],
    }).success).toBe(true);
  });
});
