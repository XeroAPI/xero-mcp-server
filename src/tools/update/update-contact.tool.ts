import { updateXeroContact } from "../../handlers/update-xero-contact.handler.js";
import { z } from "zod";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { getContactRoleLabel } from "../../helpers/get-contact-role-label.js";

const UpdateContactTool = CreateXeroTool(
  "update-contact",
  "Update a contact in Xero.\
 This tool cannot set Xero's `Customer` or `Supplier` flags because those fields are read-only and automatically managed by Xero based on AR and AP activity. \
 When a contact is updated, a deep link to the contact in Xero is returned. \
 This deep link can be used to view the contact in Xero directly. \
 This link should be displayed to the user.",
  {
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
  },
  async ({
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
  }) => {
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
              `Role: ${getContactRoleLabel(contact.isCustomer, contact.isSupplier)}`,
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
  },
);

export default UpdateContactTool;
