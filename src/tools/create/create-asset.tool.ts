import { createXeroAsset } from "../../handlers/create-xero-asset.handler.js";
import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { BookDepreciationSetting, BookDepreciationDetail } from "xero-node/dist/gen/model/assets/models.js";

const CreateAssetTool = CreateXeroTool(
  "create-asset",
  "Create an asset in Xero. \
  Assets can be created with just a name and number, but you can also provide additional details like purchase date and price, asset type, and serial number. \
  Assets are created in the DRAFT status only. Use the update tool to change the status or other details after creation. \
  If the asset is successfully created, a confirmation message with the asset details will be returned. \
  If there is an error creating the asset, an error message will be returned.",
  {
    assetName: z.string().describe("The name of the asset"),
    assetNumber: z.string().optional().describe("A unique asset number. Must be unique."),
    assetTypeId: z.string().optional().describe("The Xero-generated ID for the asset type"),
    purchaseDate: z.string().optional().describe("The date the asset was purchased (YYYY-MM-DD)"),
    purchasePrice: z.number().optional().describe("The purchase price of the asset"),
    warrantyExpiryDate: z.string().optional().describe("The date the asset's warranty expires (YYYY-MM-DD)"),
    serialNumber: z.string().optional().describe("The asset's serial number"),
    depreciationMethod: z.string().optional().describe("Depreciation method: NoDepreciation, StraightLine, DiminishingValue100, DiminishingValue150, DiminishingValue200, FullDepreciation"),
    averagingMethod: z.string().optional().describe("Averaging method: FullMonth, ActualDays"),
    depreciationRate: z.number().optional().describe("Depreciation rate as decimal (e.g., 0.4 for 40%)"),
    effectiveLifeYears: z.number().optional().describe("Effective life in years for straight line depreciation"),
    depreciationStartDate: z.string().optional().describe("Depreciation start date (YYYY-MM-DD)"),
    costLimit: z.number().optional().describe("The value to depreciate if less than purchase price"),
    residualValue: z.number().optional().describe("Remaining value after full depreciation"),
    priorAccumDepreciationAmount: z.number().optional().describe("Depreciation from prior years"),
    currentAccumDepreciationAmount: z.number().optional().describe("Depreciation in current year"),
  },
  async ({ assetName, assetNumber, assetTypeId, purchaseDate, purchasePrice, warrantyExpiryDate, serialNumber, depreciationMethod, averagingMethod, depreciationRate, effectiveLifeYears, depreciationStartDate, costLimit, residualValue, priorAccumDepreciationAmount, currentAccumDepreciationAmount }) => {
    try {
      // Construct BookDepreciationSetting if any depreciation parameters provided
      let bookDepreciationSetting: BookDepreciationSetting | undefined = undefined;
      if (depreciationMethod || averagingMethod || depreciationRate !== undefined || effectiveLifeYears !== undefined) {
        bookDepreciationSetting = {
          depreciationMethod,
          averagingMethod,
          depreciationRate,
          effectiveLifeYears,
        } as BookDepreciationSetting;
      }

      // Construct BookDepreciationDetail if any depreciation detail parameters provided
      let bookDepreciationDetail: BookDepreciationDetail | undefined = undefined;
      if (depreciationStartDate || costLimit !== undefined || residualValue !== undefined || priorAccumDepreciationAmount !== undefined || currentAccumDepreciationAmount !== undefined) {
        bookDepreciationDetail = {
          depreciationStartDate,
          costLimit,
          residualValue,
          priorAccumDepreciationAmount,
          currentAccumDepreciationAmount,
        } as BookDepreciationDetail;
      }

      const response = await createXeroAsset(
        assetName,
        assetNumber,
        assetTypeId,
        purchaseDate,
        purchasePrice,
        warrantyExpiryDate,
        serialNumber,
        bookDepreciationSetting,
        bookDepreciationDetail,
      );

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating asset: ${response.error}`,
            },
          ],
        };
      }

      const asset = response.result;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Asset created successfully`,
              `Asset ID: ${asset.assetId}`,
              `Asset Name: ${asset.assetName}`,
              asset.assetNumber ? `Asset Number: ${asset.assetNumber}` : null,
              asset.assetStatus ? `Status: ${asset.assetStatus}` : null,
              asset.purchaseDate ? `Purchase Date: ${asset.purchaseDate}` : null,
              asset.purchasePrice ? `Purchase Price: ${asset.purchasePrice}` : null,
              asset.serialNumber ? `Serial Number: ${asset.serialNumber}` : null,
              asset.bookDepreciationSetting ? `Depreciation Method: ${asset.bookDepreciationSetting.depreciationMethod}` : null,
              asset.bookDepreciationSetting?.depreciationRate ? `Depreciation Rate: ${asset.bookDepreciationSetting.depreciationRate}` : null,
              asset.bookDepreciationDetail?.depreciationStartDate ? `Depreciation Start Date: ${asset.bookDepreciationDetail.depreciationStartDate}` : null,
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
            text: `Error creating asset: ${error}`,
          },
        ],
      };
    }
  },
);

export default CreateAssetTool;
