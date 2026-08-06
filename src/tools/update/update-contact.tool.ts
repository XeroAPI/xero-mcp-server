import { updateXeroContact } from "../../handlers/update-xero-contact.handler.js";
import { z } from "zod";
import { Contact } from "xero-node";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const UpdateContactTool = CreateXeroTool(
  "update-contact",
  "Update a contact in Xero.\
 When a contact is updated, a deep link to the contact in Xero is returned. \
 This deep link can be used to view the contact in Xero directly. \
 This link should be displayed to the user.",
  {
    contactId: z.string(),
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    contactStatus: z
      .enum(["ACTIVE", "ARCHIVED"])
      .optional()
      .describe("Optional lifecycle status. Archived contacts cannot be used in transactions."),
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
  },
  async ({
    contactId,
    name,
    firstName,
    lastName,
    email,
    phone,
    contactStatus,
    address,
  }: {
    contactId: string;
    name?: string;
    email?: string;
    phone?: string;
    contactStatus?: "ACTIVE" | "ARCHIVED";
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
  }) => {
    if ([name, firstName, lastName, email, phone, contactStatus, address].every((value) => value === undefined)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error updating contact: Provide at least one contact field to update.",
          },
        ],
      };
    }

    try {
      const response = await updateXeroContact(
        contactId,
        name,
        firstName,
        lastName,
        email,
        phone,
        address,
        contactStatus
          ? Contact.ContactStatusEnum[contactStatus]
          : undefined,
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
            text: `Error updating contact: ${err.message}`,
          },
        ],
      };
    }
  },
);

export default UpdateContactTool;
