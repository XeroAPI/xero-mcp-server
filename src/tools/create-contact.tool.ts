import { createXeroContact } from "../handlers/create-xero-contact.handler.js";
import { z } from "zod";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "create-contact";
const toolDescription = "Create a contact in Xero.";
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
            text: `Error listing contacts: ${response.error}`,
          },
        ],
      };
    }

    const contact = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Contact created: ${contact.name} (ID: ${contact.contactID})`,
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
