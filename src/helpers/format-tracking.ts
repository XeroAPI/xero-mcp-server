import { TrackingCategory } from "xero-node";

/**
 * Format a line's tracking categories as readable `category/option` text.
 *
 * Manual journal lines (and other line types) can carry up to two tracking
 * categories. Printing the raw array yields `[object Object]`, so this renders
 * each entry as `name/option` (or just `name` when the option is absent) and
 * joins multiple entries with commas.
 *
 * @returns the formatted string, or `null` when there is nothing to show so
 * callers can omit the line cleanly.
 */
export const formatTracking = (
  tracking?: TrackingCategory[],
): string | null => {
  if (!tracking || tracking.length === 0) {
    return null;
  }

  const formatted = tracking
    .map((category) =>
      [category.name, category.option].filter(Boolean).join("/"),
    )
    .filter((entry) => entry.length > 0);

  return formatted.length > 0 ? formatted.join(", ") : null;
};
