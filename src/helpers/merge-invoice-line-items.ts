import { LineItem, LineItemTracking } from "xero-node";

export interface InvoiceLineItemUpdate {
  lineItemID?: string;
  description?: string;
  quantity?: number;
  unitAmount?: number;
  accountCode?: string;
  taxType?: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

/**
 * Preserve invoice lines that are not part of a targeted LineItemID update.
 *
 * Xero treats the submitted lineItems array as the complete set of lines on an
 * invoice. A targeted update therefore still needs to include every existing
 * line, even though Xero preserves omitted fields on the line whose ID is sent.
 */
export function mergeInvoiceLineItems(
  existingLineItems: LineItem[] = [],
  requestedLineItems?: InvoiceLineItemUpdate[],
): LineItem[] | undefined {
  if (requestedLineItems === undefined) {
    return undefined;
  }

  const targetedUpdates = requestedLineItems.filter(
    (lineItem): lineItem is InvoiceLineItemUpdate & { lineItemID: string } =>
      lineItem.lineItemID !== undefined,
  );

  // Preserve the existing replacement behavior when no line item IDs are used.
  if (targetedUpdates.length === 0) {
    return requestedLineItems;
  }

  const updatesById = new Map<string, InvoiceLineItemUpdate>();
  for (const lineItem of targetedUpdates) {
    if (updatesById.has(lineItem.lineItemID)) {
      throw new Error(`Duplicate lineItemID: ${lineItem.lineItemID}`);
    }
    updatesById.set(lineItem.lineItemID, lineItem);
  }

  const existingIds = new Set(
    existingLineItems
      .map((lineItem) => lineItem.lineItemID)
      .filter((lineItemID): lineItemID is string => lineItemID !== undefined),
  );

  for (const lineItemID of updatesById.keys()) {
    if (!existingIds.has(lineItemID)) {
      throw new Error(
        `Cannot update line item ${lineItemID} because it is not on the invoice.`,
      );
    }
  }

  const mergedLineItems = existingLineItems.map((lineItem) => {
    if (!lineItem.lineItemID) {
      return lineItem;
    }
    return updatesById.get(lineItem.lineItemID) ?? lineItem;
  });

  const newLineItems = requestedLineItems.filter(
    (lineItem) => lineItem.lineItemID === undefined,
  );

  return [...mergedLineItems, ...newLineItems];
}
