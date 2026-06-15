import { updateXeroContact } from "../../handlers/update-xero-contact.handler.js";
import { z } from "zod";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { Contact, SalesTrackingCategory } from "xero-node";

const trackingCategorySchema = z.object({
  trackingCategoryName: z.string(),
  trackingOptionName: z.string(),
});

const UpdateContactTool = CreateXeroTool(
  "update-contact",
  "Update a contact in Xero.\
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
    purchasesDefaultAccountCode: z.string().optional(),
    salesDefaultAccountCode: z.string().optional(),
    purchasesDefaultLineAmountType: z
      .enum(["EXCLUSIVE", "INCLUSIVE", "NO_TAX"])
      .optional(),
    salesDefaultLineAmountType: z
      .enum(["EXCLUSIVE", "INCLUSIVE", "NO_TAX"])
      .optional(),
    defaultPurchasesTrackingCategories: z
      .array(trackingCategorySchema)
      .optional(),
    defaultSalesTrackingCategories: z.array(trackingCategorySchema).optional(),
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
    purchasesDefaultAccountCode,
    salesDefaultAccountCode,
    purchasesDefaultLineAmountType,
    salesDefaultLineAmountType,
    defaultPurchasesTrackingCategories,
    defaultSalesTrackingCategories,
    address,
  }: {
    contactId: string;
    name: string;
    email?: string;
    phone?: string;
    purchasesDefaultAccountCode?: string;
    salesDefaultAccountCode?: string;
    purchasesDefaultLineAmountType?: "EXCLUSIVE" | "INCLUSIVE" | "NO_TAX";
    salesDefaultLineAmountType?: "EXCLUSIVE" | "INCLUSIVE" | "NO_TAX";
    defaultPurchasesTrackingCategories?: Array<{
      trackingCategoryName: string;
      trackingOptionName: string;
    }>;
    defaultSalesTrackingCategories?: Array<{
      trackingCategoryName: string;
      trackingOptionName: string;
    }>;
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
      const mapTrackingCategories = (
        categories:
          | Array<{
              trackingCategoryName: string;
              trackingOptionName: string;
            }>
          | undefined,
      ): SalesTrackingCategory[] | undefined =>
        categories?.map((category) => ({
          trackingCategoryName: category.trackingCategoryName,
          trackingOptionName: category.trackingOptionName,
        }));

      const response = await updateXeroContact(
        contactId,
        name,
        firstName,
        lastName,
        email,
        phone,
        address,
        purchasesDefaultAccountCode,
        salesDefaultAccountCode,
        purchasesDefaultLineAmountType as
          | Contact.PurchasesDefaultLineAmountTypeEnum
          | undefined,
        salesDefaultLineAmountType as
          | Contact.SalesDefaultLineAmountTypeEnum
          | undefined,
        mapTrackingCategories(defaultPurchasesTrackingCategories),
        mapTrackingCategories(defaultSalesTrackingCategories),
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
  },
);

export default UpdateContactTool;
