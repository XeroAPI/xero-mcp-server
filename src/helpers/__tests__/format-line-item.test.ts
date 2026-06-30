import { describe, expect, it } from "vitest";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("formats tracking categories without leaking object placeholders", () => {
    const result = formatLineItem({
      tracking: [
        {
          name: "Region",
          option: "North",
          trackingCategoryID: "tracking-1",
        },
        {
          name: "Department",
          option: "Finance",
          trackingCategoryID: "tracking-2",
        },
      ],
    } as never);

    expect(result).toContain("Tracking: Region: North, Department: Finance");
    expect(result).not.toContain("[object Object]");
  });

  it("falls back to the tracking category id when names are missing", () => {
    const result = formatLineItem({
      tracking: [{ trackingCategoryID: "tracking-3" }],
    } as never);

    expect(result).toContain("Tracking: tracking-3");
  });
});
