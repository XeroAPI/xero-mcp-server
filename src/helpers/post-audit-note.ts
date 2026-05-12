/**
 * Post a History note on a Xero resource attributing the action to the
 * authenticated MCP user.
 *
 * Xero attributes API actions to the OAuth app, so the system-generated
 * History row says "MCP for Accounting Software" rather than the user's
 * name. We layer a manual note on top of every successful write so the
 * History tab visibly shows which teammate did what.
 *
 * Failures are logged and swallowed — never propagate to the calling
 * handler. A missing audit note is far less bad than a failed write.
 */
import { HistoryRecords } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";

export type AuditableResource =
  | "Invoice"
  | "Contact"
  | "CreditNote"
  | "BankTransaction"
  | "ManualJournal"
  | "Payment"
  | "Quote"
  | "Item"
  | "PurchaseOrder"
  | "RepeatingInvoice";

const VIA = "Claude Desktop MCP";

function userName(): string {
  return (process.env.XERO_USER_NAME ?? "").trim() || "Unknown user";
}

export async function postAuditNote(
  resourceType: AuditableResource,
  resourceId: string | undefined,
  action: "Created" | "Updated" = "Created",
): Promise<void> {
  if (!resourceId) return;
  const details = `${action} by ${userName()} via ${VIA}`;
  const body: HistoryRecords = {
    historyRecords: [{ details }],
  };
  try {
    await xeroClient.authenticate();
    const api = xeroClient.accountingApi;
    const tenantId = xeroClient.tenantId;
    switch (resourceType) {
      case "Invoice":
        await api.createInvoiceHistory(tenantId, resourceId, body);
        return;
      case "Contact":
        await api.createContactHistory(tenantId, resourceId, body);
        return;
      case "CreditNote":
        await api.createCreditNoteHistory(tenantId, resourceId, body);
        return;
      case "BankTransaction":
        await api.createBankTransactionHistoryRecord(tenantId, resourceId, body);
        return;
      case "ManualJournal":
        await api.createManualJournalHistoryRecord(tenantId, resourceId, body);
        return;
      case "Payment":
        await api.createPaymentHistory(tenantId, resourceId, body);
        return;
      case "Quote":
        await api.createQuoteHistory(tenantId, resourceId, body);
        return;
      case "Item":
        await api.createItemHistory(tenantId, resourceId, body);
        return;
      case "PurchaseOrder":
        await api.createPurchaseOrderHistory(tenantId, resourceId, body);
        return;
      case "RepeatingInvoice":
        await api.createRepeatingInvoiceHistory(tenantId, resourceId, body);
        return;
    }
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error(
      `[audit] failed to post ${action} note on ${resourceType} ${resourceId}: ${msg}`,
    );
  }
}
