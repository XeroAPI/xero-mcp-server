import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatTrackingOption } from "../../helpers/format-tracking-option.js";
import { updateXeroTrackingOption } from "../../handlers/update-xero-tracking-options.handler.js";

const trackingOptionSchema = z.object({
  trackingOptionId: z.string().min(1),
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
});

const UpdateTrackingOptionsTool = CreateXeroTool(
  "update-tracking-options",
  `Updates tracking options for a tracking category in Xero.`,
  {
    trackingCategoryId: z.string().min(1),
    options: z.array(trackingOptionSchema).min(1).max(10)
  },
  async ({ trackingCategoryId, options }) => {
    const response = await updateXeroTrackingOption(trackingCategoryId, options);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error while updating tracking options: ${response.error}`
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
            `${trackingOptions.length} out of ${options.length} tracking options updated:`,
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

export default UpdateTrackingOptionsTool;
