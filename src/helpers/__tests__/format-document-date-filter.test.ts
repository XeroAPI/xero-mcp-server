import { describe, expect, it } from "vitest";
import { formatDocumentDateFilter } from "../format-document-date-filter.js";

describe("formatDocumentDateFilter", () => {
  it("returns no filter when no range is provided", () => {
    expect(formatDocumentDateFilter()).toBeUndefined();
  });

  it("formats an inclusive start date", () => {
    expect(formatDocumentDateFilter("2026-01-02")).toBe(
      "Date >= DateTime(2026, 01, 02)",
    );
  });

  it("formats an inclusive end date", () => {
    expect(formatDocumentDateFilter(undefined, "2026-03-04")).toBe(
      "Date <= DateTime(2026, 03, 04)",
    );
  });

  it("combines both date boundaries", () => {
    expect(formatDocumentDateFilter("2025-10-01", "2026-05-01")).toBe(
      "Date >= DateTime(2025, 10, 01) && Date <= DateTime(2026, 05, 01)",
    );
  });
});
