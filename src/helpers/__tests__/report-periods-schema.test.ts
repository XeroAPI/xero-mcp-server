import { describe, expect, it } from "vitest";
import { reportPeriodsSchema } from "../report-periods-schema.js";

describe("reportPeriodsSchema", () => {
  it("accepts Xero's supported report period range", () => {
    expect(reportPeriodsSchema.safeParse(1).success).toBe(true);
    expect(reportPeriodsSchema.safeParse(11).success).toBe(true);
  });

  it.each([0, 12, 1.5])("rejects unsupported period count %s", (periods) => {
    expect(reportPeriodsSchema.safeParse(periods).success).toBe(false);
  });
});
