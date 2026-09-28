import { RepeatingInvoice, Schedule } from "xero-node";
import { formatLineItem } from "./format-line-item.js";

function formatSchedule(schedule?: Schedule): string | null {
  if (!schedule) {
    return null;
  }

  const cadence =
    schedule.period != null && schedule.unit
      ? `every ${schedule.period} ${String(schedule.unit).toLowerCase()}`
      : null;
  const due =
    schedule.dueDate != null && schedule.dueDateType
      ? `due ${schedule.dueDate} ${schedule.dueDateType}`
      : null;

  return [
    "Schedule:",
    cadence,
    due,
    schedule.startDate ? `Start Date: ${schedule.startDate}` : null,
    schedule.nextScheduledDate
      ? `Next Scheduled Date: ${schedule.nextScheduledDate}`
      : null,
    schedule.endDate ? `End Date: ${schedule.endDate}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export const formatRepeatingInvoice = (
  repeatingInvoice: RepeatingInvoice,
  options?: { includeLineItems?: boolean },
): string => {
  return [
    `ID: ${repeatingInvoice.repeatingInvoiceID || repeatingInvoice.iD}`,
    `Type: ${repeatingInvoice.type || "Unknown"}`,
    `Status: ${repeatingInvoice.status || "Unknown"}`,
    repeatingInvoice.reference
      ? `Reference: ${repeatingInvoice.reference}`
      : null,
    repeatingInvoice.contact
      ? `Contact: ${repeatingInvoice.contact.name} (${repeatingInvoice.contact.contactID})`
      : null,
    formatSchedule(repeatingInvoice.schedule),
    repeatingInvoice.lineAmountTypes
      ? `Line Amount Types: ${repeatingInvoice.lineAmountTypes}`
      : null,
    repeatingInvoice.subTotal != null
      ? `Sub Total: ${repeatingInvoice.subTotal}`
      : null,
    repeatingInvoice.totalTax != null
      ? `Total Tax: ${repeatingInvoice.totalTax}`
      : null,
    `Total: ${repeatingInvoice.total || 0}`,
    repeatingInvoice.currencyCode
      ? `Currency: ${repeatingInvoice.currencyCode}`
      : null,
    repeatingInvoice.hasAttachments ? "Has Attachments: Yes" : null,
    options?.includeLineItems
      ? `Line Items:\n${repeatingInvoice.lineItems?.map(formatLineItem).join("\n---\n") || "None"}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
};
