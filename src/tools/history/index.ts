import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import {
  getEntityHistory,
  addEntityNote,
  HistoryEntityConfig,
} from "../../handlers/history-handler-factory.js";
import { xeroClient } from "../../clients/xero-client.js";
import { HistoryRecord } from "xero-node";

interface HistoryEntityDefinition {
  entity: string;
  idParam: string;
  idDescription: string;
  config: HistoryEntityConfig;
}

const HISTORY_ENTITIES: HistoryEntityDefinition[] = [
  {
    entity: "invoice",
    idParam: "invoiceID",
    idDescription: "The Xero invoice ID.",
    config: {
      getMethod: xeroClient.accountingApi.getInvoiceHistory,
      createMethod: xeroClient.accountingApi.createInvoiceHistory,
    },
  },
  {
    entity: "contact",
    idParam: "contactID",
    idDescription: "The Xero contact ID.",
    config: {
      getMethod: xeroClient.accountingApi.getContactHistory,
      createMethod: xeroClient.accountingApi.createContactHistory,
    },
  },
  {
    entity: "credit-note",
    idParam: "creditNoteID",
    idDescription: "The Xero credit note ID.",
    config: {
      getMethod: xeroClient.accountingApi.getCreditNoteHistory,
      createMethod: xeroClient.accountingApi.createCreditNoteHistory,
    },
  },
  {
    entity: "bank-transaction",
    idParam: "bankTransactionID",
    idDescription: "The Xero bank transaction ID.",
    config: {
      getMethod: xeroClient.accountingApi.getBankTransactionsHistory,
      createMethod:
        xeroClient.accountingApi.createBankTransactionHistoryRecord,
    },
  },
  {
    entity: "quote",
    idParam: "quoteID",
    idDescription: "The Xero quote ID.",
    config: {
      getMethod: xeroClient.accountingApi.getQuoteHistory,
      createMethod: xeroClient.accountingApi.createQuoteHistory,
    },
  },
];

function formatHistoryRecord(record: HistoryRecord): string {
  return [
    record.dateUTC ? `Date: ${record.dateUTC}` : null,
    record.user ? `User: ${record.user}` : null,
    record.details ? `Details: ${record.details}` : null,
    record.changes ? `Changes: ${record.changes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function createGetHistoryTool(def: HistoryEntityDefinition) {
  return CreateXeroTool(
    `get-${def.entity}-history`,
    `Retrieve the history (audit trail) for a specific ${def.entity} in Xero. Returns a list of history records including dates, users, details, and changes.`,
    {
      [def.idParam]: z.string().describe(def.idDescription),
    },
    async (params: Record<string, string>) => {
      const entityId = params[def.idParam];
      const response = await getEntityHistory(entityId, def.config);

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error retrieving ${def.entity} history: ${response.error}`,
            },
          ],
        };
      }

      const records = response.result;

      if (records.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No history found for ${def.entity}: ${entityId}`,
            },
          ],
        };
      }

      const formatted = records.map(formatHistoryRecord).join("\n---\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `History for ${def.entity} ${entityId} (${records.length} record${records.length === 1 ? "" : "s"}):\n\n${formatted}`,
          },
        ],
      };
    },
  );
}

function createAddNoteTool(def: HistoryEntityDefinition) {
  return CreateXeroTool(
    `add-${def.entity}-note`,
    `Add a note to a specific ${def.entity} in Xero. Notes appear in the entity's history/audit trail. WARNING: Notes are immutable — once created they cannot be edited or deleted.`,
    {
      [def.idParam]: z.string().describe(def.idDescription),
      note: z
        .string()
        .describe(
          "The note text to add. This is immutable and cannot be edited or deleted after creation.",
        ),
    },
    async (params: Record<string, string>) => {
      const entityId = params[def.idParam];
      const { note } = params;
      const response = await addEntityNote(entityId, note, def.config);

      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error adding note to ${def.entity}: ${response.error}`,
            },
          ],
        };
      }

      const record = response.result;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Note added to ${def.entity} ${entityId}.`,
              record.dateUTC ? `Date: ${record.dateUTC}` : null,
              record.user ? `User: ${record.user}` : null,
              `Details: ${record.details}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    },
  );
}

export const HistoryTools = HISTORY_ENTITIES.flatMap((def) => [
  createGetHistoryTool(def),
  createAddNoteTool(def),
]);
