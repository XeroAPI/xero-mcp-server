import { z } from "zod";
import { deleteXeroRepeatingInvoice } from "../../handlers/delete-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatRepeatingInvoice } from "../../helpers/format-repeating-invoice.js";

const DeleteRepeatingInvoiceTool = CreateXeroTool(
  "delete-repeating-invoice",
  `Delete a repeating invoice template in Xero by setting its status to DELETED.
  Already-generated invoices are not deleted and must be handled separately.`,
  {
    repeatingInvoiceId: z
      .string()
      .describe("The ID of the repeating invoice template to delete."),
  },
  async ({ repeatingInvoiceId }) => {
    const response = await deleteXeroRepeatingInvoice(repeatingInvoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting repeating invoice: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Successfully deleted repeating invoice with ID: ${repeatingInvoiceId}`,
            formatRepeatingInvoice(response.result),
          ].join("\n"),
        },
      ],
    };
  },
);

export default DeleteRepeatingInvoiceTool;
