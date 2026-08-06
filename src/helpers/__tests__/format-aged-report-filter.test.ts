import { describe, expect, it } from "vitest";
import { formatAgedReportFilter } from "../format-aged-report-filter.js";

describe("formatAgedReportFilter", () => {
  it("uses invoices by default for aged receivables", () => {
    expect(formatAgedReportFilter("2026-01-01", "2026-01-31")).toBe(
      "Showing invoices from 2026-01-01 to 2026-01-31",
    );
  });

  it("labels aged payables filters as bills", () => {
    expect(formatAgedReportFilter("2026-01-01", undefined, "bills")).toBe(
      "Showing bills from 2026-01-01",
    );
  });

  it("returns no filter text when neither date is supplied", () => {
    expect(formatAgedReportFilter()).toBeUndefined();
  });
});
