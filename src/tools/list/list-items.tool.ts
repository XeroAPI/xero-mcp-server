import { z } from "zod";
import { listXeroItems } from "../../handlers/list-xero-items.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListItemsTool = CreateXeroTool(
  "list-items",
  "Lists all items in Xero. Use this tool to get the item codes and descriptions to be used when creating invoices in Xero",
  {
    page: z.number(),
  },
  async ({ page }) => {
    const response = await listXeroItems(page);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing items: ${response.error}`,
          },
        ],
      };
    }

    const items = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${items?.length || 0} items:`,
        },
        ...(items?.map((item) => ({
          type: "text" as const,
          text: [
            `Item: ${item.name || "Unnamed"}`,
            `ID: ${item.itemID}`,
            `Code: ${item.code}`,
            item.description ? `Description: ${item.description}` : null,
            item.purchaseDescription ? `Purchase Description: ${item.purchaseDescription}` : null,
            item.salesDetails?.unitPrice !== undefined ? `Sales Price: ${item.salesDetails.unitPrice}` : null,
            item.purchaseDetails?.unitPrice !== undefined ? `Purchase Price: ${item.purchaseDetails.unitPrice}` : null,
            item.salesDetails?.accountCode ? `Sales Account: ${item.salesDetails.accountCode}` : null,
            item.purchaseDetails?.accountCode ? `Purchase Account: ${item.purchaseDetails.accountCode}` : null,
            item.isTrackedAsInventory !== undefined ? `Tracked as Inventory: ${item.isTrackedAsInventory ? 'Yes' : 'No'}` : null,
            item.isSold !== undefined ? `Is Sold: ${item.isSold ? 'Yes' : 'No'}` : null,
            item.isPurchased !== undefined ? `Is Purchased: ${item.isPurchased ? 'Yes' : 'No'}` : null,
            item.updatedDateUTC ? `Last Updated: ${item.updatedDateUTC}` : null,
            item.validationErrors?.length ? `Validation Errors: ${item.validationErrors.map(e => e.message).join(", ")}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListItemsTool; 