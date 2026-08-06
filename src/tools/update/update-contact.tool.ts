import { updateXeroContact } from "../../handlers/update-xero-contact.handler.js";
import { z } from "zod";
import { Address, Contact, Phone } from "xero-node";
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
    phoneType: z
      .enum(["DEFAULT", "DDI", "MOBILE", "FAX", "OFFICE"])
      .optional()
      .describe("Type of the supplied phone number. Defaults to MOBILE."),
    phoneCountryCode: z
      .string()
      .optional()
      .describe("Country calling code for the supplied phone number, without the leading +."),
    phoneAreaCode: z
      .string()
      .optional()
      .describe("Area code for the supplied phone number."),
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
        addressType: z
          .enum(["STREET", "POBOX"])
          .optional()
          .describe("Optional address type. Use POBOX for a mailing address."),
      })
      .optional(),
    idempotencyKey: z.string().min(1).max(128).optional().describe(
      "Optional retry key. Reuse the same key when retrying this exact contact update to prevent duplicate processing.",
    ),
  },
  async ({
    contactId,
    name,
    firstName,
    lastName,
    email,
    phone,
    phoneType,
    phoneCountryCode,
    phoneAreaCode,
    contactStatus,
    address,
    idempotencyKey,
  }: {
    contactId: string;
    name?: string;
    email?: string;
    phone?: string;
    phoneType?: "DEFAULT" | "DDI" | "MOBILE" | "FAX" | "OFFICE";
    phoneCountryCode?: string;
    phoneAreaCode?: string;
    contactStatus?: "ACTIVE" | "ARCHIVED";
    address?: {
      addressLine1: string;
      addressLine2?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      addressType?: "STREET" | "POBOX";
    };
    firstName?: string;
    lastName?: string;
    idempotencyKey?: string;
  }) => {
    const hasPhoneDetails = [
      phoneType,
      phoneCountryCode,
      phoneAreaCode,
    ].some((value) => value !== undefined);

    if ([
      name,
      firstName,
      lastName,
      email,
      phone,
      phoneType,
      phoneCountryCode,
      phoneAreaCode,
      contactStatus,
      address,
    ].every((value) => value === undefined)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error updating contact: Provide at least one contact field to update.",
          },
        ],
      };
    }

    if (phone === undefined && hasPhoneDetails) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error updating contact: A phone number is required when setting phone details.",
          },
        ],
      };
    }

    try {
      const xeroAddress = address
        ? {
            ...address,
            addressType: address.addressType
              ? Address.AddressTypeEnum[address.addressType]
              : undefined,
          }
        : undefined;
      const response = await updateXeroContact(
        contactId,
        name,
        firstName,
        lastName,
        email,
        phone,
        xeroAddress,
        contactStatus
          ? Contact.ContactStatusEnum[contactStatus]
          : undefined,
        phoneType ? Phone.PhoneTypeEnum[phoneType] : undefined,
        phoneCountryCode,
        phoneAreaCode,
        idempotencyKey,
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
