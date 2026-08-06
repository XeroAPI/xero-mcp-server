import { z } from "zod";

/**
 * Shared Zod schema for a single tracking category/option pair on a line.
 * Used by invoice and manual journal tools so the shape stays consistent.
 * Both the Xero `LineItemTracking` and `TrackingCategory` types accept these
 * three fields, so the same schema works on invoice lines and manual journal lines.
 */
export const trackingSchema = z.object({
  name: z
    .string()
    .describe(
      "The name of the tracking category. Can be obtained from the list-tracking-categories tool",
    ),
  option: z
    .string()
    .describe(
      "The name of the tracking option. Can be obtained from the list-tracking-categories tool",
    ),
  trackingCategoryID: z
    .string()
    .describe(
      "The ID of the tracking category. Optional - Xero resolves the category and option from the name and option fields, so omit it rather than calling the list-tracking-categories tool to look one up.",
    )
    .optional(),
});
