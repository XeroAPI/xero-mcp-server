import { z } from "zod";
import { updateXeroItem } from "../../handlers/update-xero-item.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const purchaseDetailsSchema = z.object({
  unitPrice: z.number().optional(),
  taxType: z.string().optional(),
  accountCode: z.string().optional(),
});

const salesDetailsSchema = z.object({
  unitPrice: z.number().optional(),
  taxType: z.string().optional(),
  accountCode: z.string().optional(),
});

const UpdateItemTool = CreateXeroTool(
  "update-item",
  "Update an item in Xero.",
  {
    itemId: z.string(),
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    purchaseDescription: z.string().optional(),
    purchaseDetails: purchaseDetailsSchema.optional(),
    salesDetails: salesDetailsSchema.optional(),
    isTrackedAsInventory: z.boolean().optional(),
    inventoryAssetAccountCode: z.string().optional(),
  },
  async ({
    itemId,
    code,
    name,
    description,
    purchaseDescription,
    purchaseDetails,
    salesDetails,
    isTrackedAsInventory,
    inventoryAssetAccountCode,
  }) => {
    const result = await updateXeroItem(
      itemId,
      {
        code,
        name,
        description,
        purchaseDescription,
        purchaseDetails,
        salesDetails,
        isTrackedAsInventory,
        inventoryAssetAccountCode,
      }
    );

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating item: ${result.error}`,
          },
        ],
      };
    }

    const item = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Item updated successfully:",
            `ID: ${item?.itemID}`,
            `Code: ${item?.code}`,
            `Name: ${item?.name}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdateItemTool; 