import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { trackingCategoryDeepLink } from "../../consts/deeplinks.js";
import { updateXeroTrackingCategory } from "../../handlers/update-xero-tracking-category.handler.js";

const UpdateTrackingCategoryTool = CreateXeroTool(
  "update-tracking-category",
  `Updates an existing tracking category in Xero. A deep link to the tracking category is returned.
  This deep link can be used to view the tracking category in Xero directly.
  This link should be displayed to the user.`,
  {
    trackingCategoryId: z.string(),
    name: z.string().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
  },
  async ({ trackingCategoryId, name, status }) => {
    const response = await updateXeroTrackingCategory(trackingCategoryId, name, status);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error while updating tracking category: ${response.error}`
          }
        ]
      };
    }

    const trackingCategory = response.result;
    const deepLink = trackingCategoryDeepLink(trackingCategoryId);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `Updated the tracking category "${trackingCategory.name}" (${trackingCategory.trackingCategoryID}).`
        },
        {
          type: "text" as const,
          text: `Link to view tracking category: ${deepLink}`
        }
      ]
    };
  }
);

export default UpdateTrackingCategoryTool;