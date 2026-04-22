import { updateXeroAsset, populateAssetForUpdate, RawAssetForUpdate } from "../../handlers/update-xero-asset.handler.js";
import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const UpdateAssetTool = CreateXeroTool(
  "update-asset",
  "Update a DRAFT asset in Xero. Provide the asset ID, status must be DRAFT and any updated values for the asset.",
  {
    assetNumber: z.string().describe("A unique asset number. Must be unique."),
    assetStatus: z.enum(["DRAFT", "Draft"]).describe("The status of the asset. Only draft assets can be updated using this tool."),
    assetId: z.string().optional().describe("The ID of the asset to update"),
    assetName: z.string().optional().describe("The name of the asset"),
    assetTypeId: z.string().optional().describe("The Xero-generated ID for the asset type"),
    purchaseDate: z.string().optional().describe("The date the asset was purchased (YYYY-MM-DD)"),
    purchasePrice: z.number().optional().describe("The purchase price of the asset"),
    warrantyExpiryDate: z.string().optional().describe("The date the asset's warranty expires (YYYY-MM-DD)"),
    serialNumber: z.string().optional().describe("The asset's serial number"),
    disposalDate: z.string().optional().describe("The date the asset was disposed (YYYY-MM-DD)"),
    disposalPrice: z.number().optional().describe("The price the asset was disposed at"),
    depreciationMethod: z.string().optional().describe("Depreciation method: NoDepreciation, StraightLine, DiminishingValue100, DiminishingValue150, DiminishingValue200, FullDepreciation"),
    averagingMethod: z.string().optional().describe("Averaging method: FullMonth, ActualDays"),
    depreciationRate: z.number().optional().describe("Depreciation rate, percentage value (e.g. use 20 for 20%)"),
    effectiveLifeYears: z.number().optional().describe("Effective life in years for straight line depreciation"),
    depreciationStartDate: z.string().optional().describe("Depreciation start date (YYYY-MM-DD)"),
    costLimit: z.number().optional().describe("The value to depreciate if less than purchase price"),
    residualValue: z.number().optional().describe("Remaining value after full depreciation"),
    priorAccumDepreciationAmount: z.number().optional().describe("Depreciation from prior years"),
    currentAccumDepreciationAmount: z.number().optional().describe("Depreciation in current year"),
  },
  async (rawAsset: RawAssetForUpdate) => {
    try {
      const asset = await populateAssetForUpdate(rawAsset);

      if (asset.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error preparing asset for update: ${asset.error}`,
            },
          ],
        };
      }

      const assetRequest = asset.result;
      const response = await updateXeroAsset(assetRequest);

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating asset: ${response.error}`,
            },
          ],
        };
      }

      const updatedAsset = response.result;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Asset updated successfully`,
              `ID: ${updatedAsset?.assetId}`,
              `Name: ${updatedAsset?.assetName}`,
              updatedAsset?.assetNumber ? `Number: ${updatedAsset.assetNumber}` : null,
              updatedAsset?.assetStatus ? `Status: ${updatedAsset.assetStatus}` : null,
              updatedAsset?.purchaseDate ? `Purchase Date: ${updatedAsset.purchaseDate}` : null,
              updatedAsset?.purchasePrice ? `Purchase Price: ${updatedAsset.purchasePrice}` : null,
              updatedAsset?.serialNumber ? `Serial Number: ${updatedAsset.serialNumber}` : null,
              updatedAsset?.warrantyExpiryDate ? `Warranty Expiry Date: ${updatedAsset.warrantyExpiryDate}` : null,
              updatedAsset?.bookDepreciationSetting ? `Depreciation Method: ${updatedAsset.bookDepreciationSetting.depreciationMethod}` : null,
              updatedAsset?.bookDepreciationSetting?.averagingMethod ? `Averaging Method: ${updatedAsset.bookDepreciationSetting.averagingMethod}` : null,
              updatedAsset?.bookDepreciationSetting?.depreciationRate ? `Depreciation Rate: ${updatedAsset.bookDepreciationSetting.depreciationRate}` : null,
              updatedAsset?.bookDepreciationSetting?.effectiveLifeYears ? `Effective Life (Years): ${updatedAsset.bookDepreciationSetting.effectiveLifeYears}` : null,
              updatedAsset?.bookDepreciationDetail?.depreciationStartDate ? `Depreciation Start Date: ${updatedAsset.bookDepreciationDetail.depreciationStartDate}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating asset: ${error}`,
          },
        ],
      };
    }
  },
);

export default UpdateAssetTool;
