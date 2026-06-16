import { z } from "zod";
import { listXeroLinkedTransactions } from "../../handlers/list-xero-linked-transactions.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListLinkedTransactionsTool = CreateXeroTool(
  "list-linked-transactions",
  `List linked transactions (billable expenses) in Xero. A billable expense links a cost on a
  source bill (ACCPAY) or spend-money transaction to a customer so it can be recharged onto
  their sales invoice (ACCREC). Filter by any combination of: a single linkedTransactionId
  (exact fetch), sourceTransactionId (all links from one bill), contactId (the customer the
  expense is assigned to), status (APPROVED/DRAFT/ONDRAFT/BILLED/VOIDED), or targetTransactionId
  (all links allocated onto one sales invoice). To find expenses that are ready to recharge to a
  customer, filter by contactId plus status "APPROVED". Ask the user if they want the next page
  after a full page is returned; if so, call again with the next page number.`,
  {
    page: z.number(),
    linkedTransactionId: z
      .string()
      .optional()
      .describe("Fetch a single linked transaction by its ID."),
    sourceTransactionId: z
      .string()
      .optional()
      .describe("Filter to links created from this source bill/spend transaction ID."),
    contactId: z
      .string()
      .optional()
      .describe("Filter to links assigned to this customer (contact) ID."),
    status: z
      .string()
      .optional()
      .describe("Filter by status: APPROVED, DRAFT, ONDRAFT, BILLED, or VOIDED."),
    targetTransactionId: z
      .string()
      .optional()
      .describe("Filter to links allocated onto this sales invoice (target) ID."),
  },
  async ({
    page,
    linkedTransactionId,
    sourceTransactionId,
    contactId,
    status,
    targetTransactionId,
  }) => {
    const response = await listXeroLinkedTransactions(
      page,
      linkedTransactionId,
      sourceTransactionId,
      contactId,
      status,
      targetTransactionId,
    );
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing linked transactions: ${response.error}`,
          },
        ],
      };
    }

    const linkedTransactions = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${linkedTransactions?.length || 0} linked transactions:`,
        },
        ...(linkedTransactions?.map((lt) => ({
          type: "text" as const,
          text: [
            `Linked Transaction ID: ${lt.linkedTransactionID}`,
            `Status: ${lt.status || "Unknown"}`,
            `Type: ${lt.type || "Unknown"}`,
            lt.sourceTransactionID ? `Source Transaction ID: ${lt.sourceTransactionID}` : null,
            lt.sourceLineItemID ? `Source Line Item ID: ${lt.sourceLineItemID}` : null,
            lt.sourceTransactionTypeCode ? `Source Type: ${lt.sourceTransactionTypeCode}` : null,
            lt.contactID ? `Contact ID: ${lt.contactID}` : null,
            lt.targetTransactionID ? `Target Transaction ID: ${lt.targetTransactionID}` : null,
            lt.targetLineItemID ? `Target Line Item ID: ${lt.targetLineItemID}` : null,
            lt.updatedDateUTC ? `Last Updated: ${lt.updatedDateUTC}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListLinkedTransactionsTool;
