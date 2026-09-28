import { describe, expect, it } from "vitest";
import { ListTools } from "./list/index.js";

describe("report summary tools are registered", () => {
  it("includes bank, budget, and executive summary reports", () => {
    const names = ListTools.map((tool) => tool().name);

    expect(names).toEqual(
      expect.arrayContaining([
        "list-bank-summary",
        "list-budget-summary",
        "list-executive-summary",
      ]),
    );
  });
});
