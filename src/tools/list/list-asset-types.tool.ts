import { listXeroAssetTypes } from "../../handlers/list-xero-asset-types.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { AssetType } from "xero-node/dist/gen/model/assets/models.js";

const ListAssetTypesTool = CreateXeroTool(
  "list-asset-types",
  "Lists all asset types available in Xero. Use this tool to get the asset type IDs to be used when creating assets in Xero.",
  {},
  async () => {
    const response = await listXeroAssetTypes();

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing asset types: ${response.error}`,
          },
        ],
      };
    }

    const assetTypes = response.result;

    const contentItems: Array<{ type: "text"; text: string }> = [
      {
        type: "text" as const,
        text: `Found ${assetTypes?.length || 0} asset types:`,
      },
    ];

    assetTypes?.forEach((assetType: AssetType) => {
      contentItems.push({
        type: "text" as const,
        text: [
          `Asset Type ID: ${assetType.assetTypeId || "No ID"}`,
          assetType.assetTypeName ? `Asset Type Name: ${assetType.assetTypeName}` : null,
          assetType.fixedAssetAccountId ? `Fixed Asset Account ID: ${assetType.fixedAssetAccountId}` : null,
          assetType.depreciationExpenseAccountId ? `Depreciation Expense Account ID: ${assetType.depreciationExpenseAccountId}` : null,
          assetType.accumulatedDepreciationAccountId ? `Accumulated Depreciation Account ID: ${assetType.accumulatedDepreciationAccountId}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    });

    return {
      content: contentItems,
    };
  },
);

export default ListAssetTypesTool;
