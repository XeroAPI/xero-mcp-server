import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatTrackingOption } from "../../helpers/format-tracking-option.js";
import { createXeroTrackingOptions } from "../../handlers/create-xero-tracking-option.handler.js";

const CreateTrackingOptionsTool = CreateXeroTool(
  "create-tracking-options",
  `Create tracking options for a tracking category in Xero.`,
  {
    trackingCategoryId: z.string().min(1),
    optionNames: z.array(z.string().min(1)).min(1).max(10),
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

    const { trackingOptions, failures } = response.result;
    
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `${trackingOptions.length} out of ${optionNames.length} tracking options created:`,
            trackingOptions.length ? trackingOptions.map(formatTrackingOption).join("\n\n") : null,
            failures.length
              ? `Failed:\n${failures.map((failure) => `- ${failure.input}: ${failure.error}`).join("\n")}`
              : null,
          ].filter(Boolean).join("\n")
        },
      ]
    };
  }
);

export default CreateTrackingOptionsTool;
