import { z } from "zod";
import { listXeroAssets } from "../../handlers/list-xero-assets.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { Asset } from "xero-node/dist/gen/model/assets/models.js";

const ListAssetsTool = CreateXeroTool(
  "list-assets",
  "Lists assets in Xero by status: DRAFT, REGISTERED, or DISPOSED (required). \
  You can also filter by name, number, description, type; page through results, sort, and search for specific assets. \
  Ask the user if they want to filter by asset status, and if they want to search for specific assets or sort the results before running this tool. \
  If there are more than 10 results, ask the user if they want to see the next page of results and call this tool again with the next page number if they do.",
  {
    status: z.enum(["DRAFT", "REGISTERED", "DISPOSED"]).describe("The status of assets to retrieve"),
    page: z.number().optional().describe("Results are paged. This specifies which page of the results to return. The default page is 1."),
    pageSize: z.number().optional().describe("The number of records returned per page. By default the number of records returned is 10. Maximum is 200."),
    orderBy: z
      .enum(["AssetType", "AssetName", "AssetNumber", "PurchaseDate", "PurchasePrice", "DisposalDate", "DisposalPrice"])
      .optional()
      .describe("Field to order by. DisposalDate and DisposalPrice are only available when status is DISPOSED."),
    sortDirection: z.enum(["asc", "desc"]).optional().describe("Sort direction - ASC or DESC"),
    filterBy: z.string().optional().describe("A string to filter the list to only return assets containing the text. Checks against AssetName, AssetNumber, Description and AssetTypeName."),
  },
  async ({ status, page, pageSize, orderBy, sortDirection, filterBy }) => {
    const response = await listXeroAssets(
      status as any,
      page,
      pageSize,
      orderBy as any,
      sortDirection as any,
      filterBy,
    );

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing assets: ${response.error}`,
          },
        ],
      };
    }

    const assetsData = response.result;
    const assets = assetsData?.items ?? [];

    const contentItems: Array<{ type: "text"; text: string }> = [
      {
        type: "text" as const,
        text: `Found ${assets.length || 0} assets:`,
      },
    ];

    if (assetsData?.pagination) {
      contentItems.push({
        type: "text" as const,
        text: `Pagination: Page ${assetsData.pagination.page}, Page Size: ${assetsData.pagination.pageSize}, Total Pages: ${assetsData.pagination.pageCount}`,
      });
    }

    assets?.forEach((asset: Asset) => {
      contentItems.push({
        type: "text" as const,
        text: [
          `Asset ID: ${asset.assetId || "No ID"}`,
          `Asset Name: ${asset.assetName || "No name"}`,
          asset.assetNumber ? `Asset Number: ${asset.assetNumber}` : null,
          asset.assetTypeId ? `Asset Type ID: ${asset.assetTypeId}` : null,
          asset.assetStatus ? `Status: ${asset.assetStatus}` : null,
          asset.purchaseDate ? `Purchase Date: ${asset.purchaseDate}` : null,
          asset.purchasePrice ? `Purchase Price: ${asset.purchasePrice}` : null,
          asset.disposalDate ? `Disposal Date: ${asset.disposalDate}` : null,
          asset.disposalPrice ? `Disposal Price: ${asset.disposalPrice}` : null,
          asset.warrantyExpiryDate ? `Warranty Expiry Date: ${asset.warrantyExpiryDate}` : null,
          asset.serialNumber ? `Serial Number: ${asset.serialNumber}` : null,
          asset.accountingBookValue ? `Accounting Book Value: ${asset.accountingBookValue}` : null,
          asset.bookDepreciationSetting ? `Book Depreciation Setting: ${JSON.stringify(asset.bookDepreciationSetting)}` : null,
          asset.bookDepreciationDetail ? `Book Depreciation Detail: ${JSON.stringify(asset.bookDepreciationDetail)}` : null,
          asset.canRollback === undefined ? null : `Can Rollback: ${asset.canRollback}`,
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

export default ListAssetsTool;
