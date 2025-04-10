import { z } from "zod";
import { createXeroItem } from "../../handlers/create-xero-item.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const purchaseDetailsSchema = z.object({
  unitPrice: z.number(),
  taxType: z.string().optional(),
  accountCode: z.string().optional(),
});

const salesDetailsSchema = z.object({
  unitPrice: z.number(),
  taxType: z.string().optional(),
  accountCode: z.string().optional(),
});

const CreateItemTool = CreateXeroTool(
  "create-item",
  "Create an item in Xero.",
  {
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
    code,
    name,
    description,
    purchaseDescription,
    purchaseDetails,
    salesDetails,
    isTrackedAsInventory,
    inventoryAssetAccountCode,
  }) => {
    const result = await createXeroItem({
      code,
      name,
      description,
      purchaseDescription,
      purchaseDetails,
      salesDetails,
      isTrackedAsInventory,
      inventoryAssetAccountCode,
    });

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating item: ${result.error}`,
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
            "Item created successfully:",
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

export default CreateItemTool; 