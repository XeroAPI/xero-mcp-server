import { describe, expect, it } from "vitest";

import {
  buildBankTransactionsWhere,
  parseIsoDate,
} from "../build-bank-transactions-where.js";

const ACCOUNT = "13918178-849a-4823-9a31-57b7eac713d7";

describe("buildBankTransactionsWhere", () => {
  it("returns undefined with no filters", () => {
    expect(buildBankTransactionsWhere({})).toBeUndefined();
  });

  it("filters by bank account only", () => {
    expect(buildBankTransactionsWhere({ bankAccountId: ACCOUNT })).toBe(
      `BankAccount.AccountID=guid("${ACCOUNT}")`,
    );
  });

  it("builds an inclusive quarter range", () => {
    expect(
      buildBankTransactionsWhere({ fromDate: "2026-07-01", toDate: "2026-09-30" }),
    ).toBe("Date >= DateTime(2026,07,01) && Date <= DateTime(2026,09,30)");
  });

  it("supports open-ended ranges", () => {
    expect(buildBankTransactionsWhere({ fromDate: "2026-10-01" })).toBe(
      "Date >= DateTime(2026,10,01)",
    );
    expect(buildBankTransactionsWhere({ toDate: "2026-06-30" })).toBe(
      "Date <= DateTime(2026,06,30)",
    );
  });

  it("combines account and dates", () => {
    expect(
      buildBankTransactionsWhere({
        bankAccountId: ACCOUNT,
        fromDate: "2026-07-01",
        toDate: "2026-09-30",
      }),
    ).toBe(
      `BankAccount.AccountID=guid("${ACCOUNT}") && Date >= DateTime(2026,07,01) && Date <= DateTime(2026,09,30)`,
    );
  });

  it("accepts a single-day range", () => {
    expect(
      buildBankTransactionsWhere({ fromDate: "2026-08-15", toDate: "2026-08-15" }),
    ).toBe("Date >= DateTime(2026,08,15) && Date <= DateTime(2026,08,15)");
  });

  it("rejects a reversed range", () => {
    expect(() =>
      buildBankTransactionsWhere({ fromDate: "2026-09-30", toDate: "2026-07-01" }),
    ).toThrow(/after toDate/);
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => buildBankTransactionsWhere({ fromDate: "01/07/2026" })).toThrow(/YYYY-MM-DD/);
    expect(() => buildBankTransactionsWhere({ toDate: "2026-02-30" })).toThrow(/real calendar date/);
    expect(() => buildBankTransactionsWhere({ toDate: "2026-13-01" })).toThrow(/real calendar date/);
  });

  it("rejects a non-GUID bank account id (no where-clause injection)", () => {
    expect(() =>
      buildBankTransactionsWhere({ bankAccountId: `x") || Total > guid("0` }),
    ).toThrow(/Invalid bankAccountId/);
  });

  it("accepts leap day", () => {
    expect(parseIsoDate("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
  });
});
