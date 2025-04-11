import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroTrackingCategories } from "../../handlers/list-xero-tracking-categories.handler.js";
import { formatTrackingOption } from "../../helpers/format-tracking-option.js";

const ListTrackingCategoriesTool = CreateXeroTool(
  "list-tracking-categories",
  "List all tracking categories in Xero, along with their associated tracking options.",
  {
    includeArchived: z.boolean().optional()
      .describe("Determines whether or not archived categories will be returned. By default, no archived categories will be returned.")
  },
  async ({ includeArchived }) => {
    const response = await listXeroTrackingCategories(includeArchived);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing tracking categories: ${response.error}`
          }
        ]
      };
    }

    const trackingCategories = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${trackingCategories?.length || 0} tracking categories:`
        },
        ...(trackingCategories?.map((category) => ({
          type: "text" as const,
          text: [
            `Tracking Category ID: ${category.trackingCategoryID}`,
            `Name: ${category.name}`,
            `Status: ${category.status}`,
            `Found ${category.options?.length || 0} tracking options:\n${category.options?.map(formatTrackingOption)}`
          ].filter(Boolean).join("\n")
        })) || [])
      ]
    };
  }
);

export default ListTrackingCategoriesTool;