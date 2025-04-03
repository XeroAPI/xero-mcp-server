import { createXeroContact } from "../handlers/create-xero-contact.handler.js";
import { z } from "zod";
import { ToolDefinition } from "../types/tool-definition.js";
import { DeepLinkType, getDeepLink } from "../helpers/get-deeplink.js";

const toolName = "create-contact";
const toolDescription =
  "Create a contact in Xero.\
 When a contact is created, a deep link to the contact in Xero is returned. \
 This deep link can be used to view the contact in Xero directly. \
 This link should be displayed to the user.";
const toolSchema = {
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
};

const toolHandler = async (
  { name, email, phone }: { name: string; email?: string; phone?: string },
  //_extra: { signal: AbortSignal },
) => {
  try {
    const response = await createXeroContact(name, email, phone);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating contact: ${response.error}`,
          },
        ],
      };
    }

    const contact = response.result;

    const deepLink = contact.contactID
      ? await getDeepLink(DeepLinkType.CONTACT, contact.contactID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Contact created: ${contact.name} (ID: ${contact.contactID})`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  } catch (error) {
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating contact: ${errorMessage}`,
        },
      ],
    };
  }
};

export const CreateContactTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
