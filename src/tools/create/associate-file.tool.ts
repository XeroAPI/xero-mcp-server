import { z } from "zod";

import { associateXeroFile } from "../../handlers/xero-files.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const associationObjectGroups = [
  "Account",
  "BankTransaction",
  "Contact",
  "CreditNote",
  "Invoice",
  "Item",
  "ManualJournal",
  "Overpayment",
  "Payment",
  "Prepayment",
  "Quote",
  "Receipt",
] as const;

const AssociateFileTool = CreateXeroTool(
  "associate-file",
  "Associate a Xero Files document with a Xero accounting object.",
  {
    fileId: z
      .string()
      .describe("The Xero Files file ID to associate."),
    objectId: z
      .string()
      .describe("The Xero object ID to associate the file with."),
    objectGroup: z
      .enum(associationObjectGroups)
      .optional()
      .describe("Optional Xero object group, for example Invoice or Contact."),
    objectType: z
      .string()
      .optional()
      .describe("Optional Xero object type, for example AccRec, Contact, or ManJournal."),
    sendWithObject: z
      .boolean()
      .optional()
      .describe("Optional flag indicating whether the file should be sent with the associated object on client-facing communications."),
  },
  async ({ fileId, objectId, objectGroup, objectType, sendWithObject }) => {
    const response = await associateXeroFile(
      fileId,
      objectId,
      objectGroup,
      objectType,
      sendWithObject,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error associating file: ${response.error}`,
          },
        ],
      };
    }

    const association = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "File associated successfully:",
            `File ID: ${association.fileId ?? fileId}`,
            `Object ID: ${association.objectId ?? objectId}`,
            association.objectGroup
              ? `Object Group: ${association.objectGroup}`
              : null,
            association.objectType
              ? `Object Type: ${association.objectType}`
              : null,
            association.sendWithObject !== undefined
              ? `Send With Object: ${association.sendWithObject ? "Yes" : "No"}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default AssociateFileTool;
