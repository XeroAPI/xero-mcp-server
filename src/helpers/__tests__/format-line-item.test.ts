import { describe, it, expect } from "vitest";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("renders tracking categories as readable text, not [object Object] (gh-159)", () => {
    const out = formatLineItem({
      description: "Consulting",
      quantity: 1,
      unitAmount: 100,
      tracking: [
        { name: "Project", option: "Alpha" },
        { name: "Cost Code", option: "CC-42" },
      ],
    } as never);

    expect(out).not.toContain("[object Object]");
    expect(out).toContain("Tracking: Project: Alpha, Cost Code: CC-42");
  });

  it("renders 'None' when a line item has no tracking", () => {
    const out = formatLineItem({ description: "No tracking" } as never);
    expect(out).toContain("Tracking: None");
  });
});
