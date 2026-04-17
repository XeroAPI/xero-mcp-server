import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatTrackingOption } from "../../helpers/format-tracking-option.js";
import { createXeroTrackingOptions } from "../../handlers/create-xero-tracking-option.handler.js";
import { ToolScopes } from "../../helpers/scopes.js";

const CreateTrackingOptionsTool = CreateXeroTool(
  "create-tracking-options",
  `Create tracking options for a tracking category in Xero.`,
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
    
    return {
      content: [
        {
          type: "text" as const,
          text: `${trackingOptions.length || 0} out of ${optionNames.length} tracking options created:\n${trackingOptions.map(formatTrackingOption)}`
        },
      ]
    };
  },
  ToolScopes.accountingSettings
);

export default CreateTrackingOptionsTool;