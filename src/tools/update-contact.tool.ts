import { updateXeroContact } from "../handlers/update-xero-contact.handler.js";
import { z } from "zod";
import { ToolDefinition } from "../types/tool-definition.js";
import { DeepLinkType, getDeepLink } from "../helpers/get-deeplink.js";
import { ensureError } from "../helpers/ensure-error.js";

const toolName = "update-contact";
const toolDescription =
  "Update a contact in Xero.\
 When a contact is updated, a deep link to the contact in Xero is returned. \
 This deep link can be used to view the contact in Xero directly. \
 This link should be displayed to the user.";
const toolSchema = {
  contactId: z.string(),
  name: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z
    .object({
      addressLine1: z.string(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
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

    const deepLink = contact.contactID
      ? await getDeepLink(DeepLinkType.CONTACT, contact.contactID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Contact updated: ${contact.name} (ID: ${contact.contactID})`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  } catch (error) {
    const err = ensureError(error);

    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating contact: ${err.message}`,
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
