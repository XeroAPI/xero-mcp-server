import { z } from "zod";
import { getXeroRepeatingInvoice } from "../../handlers/get-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatRepeatingInvoice } from "../../helpers/format-repeating-invoice.js";

const GetRepeatingInvoiceTool = CreateXeroTool(
  "get-repeating-invoice",
  `Retrieve a single repeating invoice template from Xero by ID.
  Line items and the full schedule are included in the response.`,
  {
    repeatingInvoiceId: z
      .string()
      .describe("The ID of the repeating invoice template to retrieve."),
  },
  async ({ repeatingInvoiceId }) => {
    const response = await getXeroRepeatingInvoice(repeatingInvoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving repeating invoice: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatRepeatingInvoice(response.result, {
            includeLineItems: true,
          }),
        },
      ],
    };
  },
);

export default GetRepeatingInvoiceTool;
