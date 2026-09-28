import { describe, expect, it } from "vitest";
import { formatRepeatingInvoice } from "../format-repeating-invoice.js";

describe("formatRepeatingInvoice", () => {
  it("formats core fields and omits missing optionals", () => {
    const text = formatRepeatingInvoice({
      repeatingInvoiceID: "ri-1",
      type: "ACCREC" as never,
      status: "AUTHORISED" as never,
      total: 5750,
      contact: { contactID: "c-1", name: "Liam Gallagher" },
    });

    expect(text).toContain("ID: ri-1");
    expect(text).toContain("Type: ACCREC");
    expect(text).toContain("Status: AUTHORISED");
    expect(text).toContain("Contact: Liam Gallagher (c-1)");
    expect(text).toContain("Total: 5750");
    expect(text).not.toContain("Reference:");
    expect(text).not.toContain("Line Items:");
    expect(text).not.toContain("Schedule:");
  });

  it("formats the schedule and line items when present", () => {
    const text = formatRepeatingInvoice(
      {
        repeatingInvoiceID: "ri-1",
        schedule: {
          period: 1,
          unit: "MONTHLY" as never,
          dueDate: 10,
          dueDateType: "OFFOLLOWINGMONTH" as never,
          startDate: "2026-01-01",
          nextScheduledDate: "2026-02-01",
          endDate: "2026-12-01",
        },
        lineItems: [
          {
            description: "Retainer",
            quantity: 1,
            unitAmount: 500,
            accountCode: "200",
            taxType: "OUTPUT2",
            lineAmount: 500,
          },
        ],
      },
      { includeLineItems: true },
    );

    expect(text).toContain("Schedule:");
    expect(text).toContain("every 1 monthly");
    expect(text).toContain("due 10 OFFOLLOWINGMONTH");
    expect(text).toContain("Start Date: 2026-01-01");
    expect(text).toContain("Next Scheduled Date: 2026-02-01");
    expect(text).toContain("End Date: 2026-12-01");
    expect(text).toContain("Line Items:");
    expect(text).toContain("Description: Retainer");
  });
});
