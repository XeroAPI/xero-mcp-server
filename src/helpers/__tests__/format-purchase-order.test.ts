import { describe, expect, it } from "vitest";
import { formatPurchaseOrder } from "../format-purchase-order.js";

describe("formatPurchaseOrder", () => {
  it("formats core purchase order fields and omits missing optionals", () => {
    const text = formatPurchaseOrder({
      purchaseOrderID: "po-1",
      purchaseOrderNumber: "PO-1001",
      status: "DRAFT" as never,
      total: 25,
      contact: { contactID: "c-1", name: "Northwind" },
    });

    expect(text).toContain("ID: po-1");
    expect(text).toContain("Number: PO-1001");
    expect(text).toContain("Status: DRAFT");
    expect(text).toContain("Contact: Northwind (c-1)");
    expect(text).toContain("Total: 25");
    expect(text).not.toContain("Reference:");
    expect(text).not.toContain("Line Items:");
  });

  it("includes line items when requested", () => {
    const text = formatPurchaseOrder(
      {
        purchaseOrderID: "po-1",
        lineItems: [
          {
            description: "Paper",
            quantity: 2,
            unitAmount: 5,
            accountCode: "429",
            taxType: "INPUT2",
            lineAmount: 10,
          },
        ],
      },
      { includeLineItems: true },
    );

    expect(text).toContain("Line Items:");
    expect(text).toContain("Description: Paper");
    expect(text).toContain("Quantity: 2");
  });
});
