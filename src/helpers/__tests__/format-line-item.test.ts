import { describe, expect, it } from "vitest";
import { LineItem } from "xero-node";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("formats tracking categories without object stringification", () => {
    const lineItem = {
      itemCode: "CONSULT",
      description: "Consulting services",
      tracking: [
        {
          name: "Project",
          option: "Website Redesign",
          trackingCategoryID: "category-1",
          trackingOptionID: "option-1",
        },
        {
          name: "Cost Centre",
          option: "Marketing",
          trackingCategoryID: "category-2",
          trackingOptionID: "option-2",
        },
      ],
      lineAmount: 120,
    } as LineItem;

    const result = formatLineItem(lineItem);

    expect(result).toContain(
      "Tracking: Category: Project, Category ID: category-1, Option: Website Redesign, Option ID: option-1; Category: Cost Centre, Category ID: category-2, Option: Marketing, Option ID: option-2",
    );
    expect(result).not.toContain("[object Object]");
  });

  it("omits tracking when there are no tracking categories", () => {
    expect(
      formatLineItem({ description: "No tracking" } as LineItem),
    ).not.toContain("Tracking:");
  });
});
