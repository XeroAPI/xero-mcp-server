import { updateXeroContact } from "../handlers/update-xero-contact.handler.js";
import { z } from "zod";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "update-contact";
const toolDescription = "Update a contact in Xero.";
const toolSchema = {
  contactId: z.string(),
  name: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.object({
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  
};

const toolHandler = async (
  { 
    contactId, 
    name, 
    firstName, 
    lastName,
    email,
    phone,
    address,
  }: {
    contactId: string;
    name: string;
    email?: string;
    phone?: string;
    address?: { 
        addressLine1: string; 
        addressLine2?: string; 
        city?: string; 
        region?: string; 
        postalCode?: string; 
        country?: string;
    };
    firstName?: string;
    lastName?: string;
  },
  //_extra: { signal: AbortSignal },
) => {
  try {
    const response = await updateXeroContact(
      contactId,
      name,
      firstName,
      lastName,
      email,
      phone,
      address,
    );
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating contact: ${response.error}`,
          },
        ],
      };
    }

    const contact = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Contact updated: ${contact.name} (ID: ${contact.contactID})`,
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

export const UpdateContactTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
