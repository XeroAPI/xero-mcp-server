import { z } from "zod";
import { deleteXeroRepeatingInvoice } from "../../handlers/delete-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeleteRepeatingInvoiceTool = CreateXeroTool(
  "delete-repeating-invoice",
  `Delete a repeating-invoice template in Xero by its ID (sets its status to DELETED).
  Note: Xero does not support editing a repeating-invoice template via the API. To change a
  template, delete it and create a new one with create-repeating-invoice.`,
  {
    repeatingInvoiceId: z
      .string()
      .describe(
        "The ID of the repeating-invoice template to delete. Can be obtained from list-repeating-invoices.",
      ),
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

    const ri = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Successfully deleted repeating invoice ${repeatingInvoiceId}`,
            `Status: ${ri?.status}`,
          ].join("\n"),
        },
      ],
    };
  },
);

export default DeleteRepeatingInvoiceTool;
