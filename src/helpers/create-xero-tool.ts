import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types/tool-definition.js";
import {
  ShapeOutput,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z } from "zod";
import {
  MutationConfirmation,
  mutationConfirmation,
} from "./mutation-confirmation.js";

const confirmationAction = z
  .enum(["prepare", "execute"])
  .describe(
    "Prepare the mutation first, then execute the unchanged payload with the returned token",
  );
const confirmationToken = z
  .string()
  .optional()
  .describe("One-time token returned by the prepare step");

const MAX_PREVIEW_CHARS = 8_000;
const MAX_PREVIEW_STRING_CHARS = 500;
const MAX_PREVIEW_ITEMS = 50;
const SENSITIVE_KEY =
  /^(?:authorization|token|secret|password|api.?key|bank.?account|account.?number|routing|bsb|email|phone|address|first.?name|last.?name|tax.?number|name|url|description|narration|reference|summary|title|terms|purchaseDescription|option|optionNames|options|.*ids?)$/i;
const REVIEWABLE_STRING_KEY =
  /^(?:date|dueDate|expiryDate|startDate|endDate|status|type|taxType|lineAmountTypes)$/i;

/** Current mutation-tool inputs reviewed when defining the preview policy. */
export const REVIEWED_MUTATION_INPUT_KEYS = [
  "accountId",
  "address",
  "amount",
  "bankAccountId",
  "bankTransactionId",
  "code",
  "contactId",
  "creditNoteId",
  "date",
  "description",
  "dueDate",
  "email",
  "employeeID",
  "endDate",
  "expiryDate",
  "firstName",
  "inventoryAssetAccountCode",
  "invoiceId",
  "isTrackedAsInventory",
  "itemId",
  "lastName",
  "lineAmountTypes",
  "lineItems",
  "manualJournalID",
  "manualJournalLines",
  "name",
  "narration",
  "optionNames",
  "options",
  "payrollCalendarID",
  "phone",
  "purchaseDescription",
  "purchaseDetails",
  "quoteId",
  "quoteNumber",
  "reference",
  "salesDetails",
  "showOnCashBasisReports",
  "startDate",
  "status",
  "summary",
  "terms",
  "timesheetID",
  "timesheetLine",
  "timesheetLineID",
  "timesheetLines",
  "title",
  "trackingCategoryId",
  "type",
  "url",
] as const;

function sanitisePreview(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (depth >= 8) return "[truncated: maximum depth reached]";
  if (typeof value === "string") {
    if (!REVIEWABLE_STRING_KEY.test(key)) return "[redacted]";
    return value.length <= MAX_PREVIEW_STRING_CHARS
      ? value
      : `${value.slice(0, MAX_PREVIEW_STRING_CHARS)}… [truncated]`;
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_PREVIEW_ITEMS)
      .map((item) => sanitisePreview(item, key, depth + 1));
    if (value.length > MAX_PREVIEW_ITEMS) {
      items.push(`[truncated: ${value.length - MAX_PREVIEW_ITEMS} more items]`);
    }
    return items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_PREVIEW_ITEMS)
        .map(([childKey, child]) => [
          childKey,
          sanitisePreview(child, childKey, depth + 1),
        ]),
    );
  }
  return value;
}

function serialisePreview(payload: unknown): string {
  const serialised = JSON.stringify(sanitisePreview(payload), null, 2);
  return serialised.length <= MAX_PREVIEW_CHARS
    ? serialised
    : `${serialised.slice(0, MAX_PREVIEW_CHARS)}\n[preview truncated]`;
}

export const CreateXeroTool = <Args extends ZodRawShapeCompat>(
  name: string,
  description: string,
  schema: Args,
  handler: ToolCallback<Args>,
): (() => ToolDefinition<ZodRawShapeCompat>) =>
  () => ({
    name,
    description,
    schema,
    handler,
  });

export const MutationXeroTool = <Args extends ZodRawShapeCompat>(
  name: string,
  description: string,
  schema: Args,
  handler: ToolCallback<Args>,
  confirmation: MutationConfirmation = mutationConfirmation,
): (() => ToolDefinition<ZodRawShapeCompat>) => {
  const createSchema: ZodRawShapeCompat = {
    ...schema,
    confirmationAction,
    confirmationToken,
  };
  const createHandler: ToolCallback<ZodRawShapeCompat> = async (
    args,
    extra,
  ) => {
    const parsed = z.object(createSchema as z.ZodRawShape).parse(args);
    const {
      confirmationAction: requestedAction,
      confirmationToken: suppliedToken,
      ...payload
    } = parsed;
    if (requestedAction === "prepare") {
      if (suppliedToken) {
        throw new Error(
          "Do not supply a confirmation token while preparing a mutation.",
        );
      }
      const prepared = await confirmation.prepare(name, payload);
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Prepared only: ${name} was not sent to Xero.`,
              `Selected Xero organisation: ${prepared.organisationId}`,
              `Confirmation token: ${prepared.token}`,
              `Expires at: ${prepared.expiresAt.toISOString()}`,
              "To execute, submit the exact same payload with confirmationAction set to execute and this one-time token.",
              "Structured identifiers, credentials and free-text fields are redacted. Remaining output is length-bounded.",
              serialisePreview(payload),
            ].join("\n"),
          },
        ],
      };
    }

    if (!suppliedToken) {
      throw new Error(
        "A confirmation token is required. Prepare the mutation first.",
      );
    }
    await confirmation.authorise(name, payload, suppliedToken);
    return handler(payload as ShapeOutput<Args>, extra);
  };

  return () => ({
    name,
    description,
    schema: createSchema,
    handler: createHandler,
  });
};
