import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroTrackingCategory } from "../../handlers/create-xero-tracking-category.handler.js";
import { trackingCategoryDeepLink } from "../../consts/deeplinks.js";

const CreateTrackingCategoryTool = CreateXeroTool(
  "create-tracking-category",
  `Create a tracking category in Xero. A deep link to the tracking category is returned.
  This deep link can be used to view the tracking category in Xero directly.
  This link should be displayed to the user.`,
  {
    name: z.string()
  },
  async ({ name }) => {
    const response = await createXeroTrackingCategory(name);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error while creating tracking category: ${response.error}`
          }
        ]
      };
    }

    const trackingCategory = response.result;
    const deepLink = trackingCategory.trackingCategoryID
      ? trackingCategoryDeepLink(trackingCategory.trackingCategoryID)
      : undefined;
    
    return {
      content: [
        {
          type: "text" as const,
          text: `Created the tracking category "${trackingCategory.name}" (${trackingCategory.trackingCategoryID}).`
        },
        {
          type: "text" as const,
          text: deepLink ? `Link to view tracking category: ${deepLink}` : ""
        }
      ]
    };
  }
);

export default CreateTrackingCategoryTool;