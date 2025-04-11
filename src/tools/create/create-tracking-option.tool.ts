import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatTrackingOption } from "../../helpers/format-tracking-option.js";
import { trackingCategoryDeepLink } from "../../consts/deeplinks.js";
import { createXeroTrackingOptions } from "../../handlers/create-xero-tracking-option.handler.js";

const CreateTrackingOptionsTool = CreateXeroTool(
  "create-tracking-options",
  `Create tracking options for a tracking category in Xero. A deep link to the tracking category is returned.
  This deep link can be used to view the tracking category along with the created options in Xero directly.
  This link should be displayed to the user.`,
  {
    trackingCategoryId: z.string(),
    optionNames: z.array(z.string()).max(10)
  },
  async ({ trackingCategoryId, optionNames }) => {
    const response = await createXeroTrackingOptions(trackingCategoryId, optionNames);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error while creating tracking options: ${response.error}`
          }
        ]
      };
    }

    const trackingOptions = response.result;
    const deepLink = trackingCategoryDeepLink(trackingCategoryId);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `${trackingOptions.length || 0} out of ${optionNames.length} tracking options created:\n${trackingOptions.map(formatTrackingOption)}`
        },
        {
          type: "text" as const,
          text: `Link to view tracking category: ${deepLink}`
        }
      ]
    };
  }
);

export default CreateTrackingOptionsTool;