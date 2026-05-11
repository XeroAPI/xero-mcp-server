import { createXeroContact } from "../../handlers/create-xero-contact.handler.js";
import { z } from "zod";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreateContactTool = CreateXeroTool(
  "create-contact",
  "Create a contact in Xero.\
  When a contact is created, a deep link to the contact in Xero is returned. \
  This deep link can be used to view the contact in Xero directly. \
  This link should be displayed to the user.",
  {
    name: z.string(),
    firstName: z
      .string()
      .optional()
      .describe("First name of the contact's primary person."),
    lastName: z
      .string()
      .optional()
      .describe("Last name of the contact's primary person."),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    postalAddress: z
      .object({
        addressLine1: z.string(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        attentionTo: z.string().optional(),
      })
      .optional()
      .describe(
        "Billing address (Xero POBOX address) — used as the address on invoices and statements sent to this contact.",
      ),
    streetAddress: z
      .object({
        addressLine1: z.string(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        attentionTo: z.string().optional(),
      })
      .optional()
      .describe("Physical/street address (Xero STREET address)."),
    contactPersons: z
      .array(
        z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          emailAddress: z.string().email().optional(),
          includeInEmails: z.boolean().optional(),
        }),
      )
      .optional()
      .describe(
        "Additional people on the contact (Xero ContactPersons), separate from the primary person above. Set includeInEmails: true to copy them on invoice/statement emails.",
      ),
    accountNumber: z
      .string()
      .optional()
      .describe("Xero 'Contact Code' / account number (max 50 chars)."),
    taxNumber: z
      .string()
      .optional()
      .describe("Tax ID / EIN / VAT / ABN (max 50 chars)."),
    taxNumberType: z
      .enum(["SSN", "EIN", "ITIN", "ATIN"])
      .optional()
      .describe("US tax ID type."),
    bankAccountDetails: z
      .string()
      .optional()
      .describe("Vendor bank account number for AP payments."),
    contactStatus: z
      .enum(["ACTIVE", "ARCHIVED", "GDPRREQUEST"])
      .optional()
      .describe("ACTIVE (default), ARCHIVED to hide, GDPRREQUEST for data-removal requests."),
    defaultCurrency: z
      .string()
      .length(3)
      .optional()
      .describe("ISO 4217 currency code (e.g. USD, EUR, GBP)."),
    accountsReceivableTaxType: z
      .string()
      .optional()
      .describe("Default sales tax type code (from list-tax-rates)."),
    accountsPayableTaxType: z
      .string()
      .optional()
      .describe("Default purchase tax type code (from list-tax-rates)."),
    salesDefaultLineAmountType: z
      .enum(["INCLUSIVE", "EXCLUSIVE", "NONE"])
      .optional()
      .describe("Default sales line amount type."),
    purchasesDefaultLineAmountType: z
      .enum(["INCLUSIVE", "EXCLUSIVE", "NONE"])
      .optional()
      .describe("Default purchases line amount type."),
    salesDefaultAccountCode: z
      .string()
      .optional()
      .describe("Default sales account code (from list-accounts)."),
    purchasesDefaultAccountCode: z
      .string()
      .optional()
      .describe("Default purchases account code (from list-accounts)."),
  },
  async ({
    name,
    firstName,
    lastName,
    email,
    phone,
    postalAddress,
    streetAddress,
    contactPersons,
    accountNumber,
    taxNumber,
    taxNumberType,
    bankAccountDetails,
    contactStatus,
    defaultCurrency,
    accountsReceivableTaxType,
    accountsPayableTaxType,
    salesDefaultLineAmountType,
    purchasesDefaultLineAmountType,
    salesDefaultAccountCode,
    purchasesDefaultAccountCode,
  }) => {
    try {
      const response = await createXeroContact(
        name,
        firstName,
        lastName,
        email,
        phone,
        postalAddress,
        streetAddress,
        contactPersons,
        {
          accountNumber,
          taxNumber,
          taxNumberType,
          bankAccountDetails,
          contactStatus,
          defaultCurrency,
          accountsReceivableTaxType,
          accountsPayableTaxType,
          salesDefaultLineAmountType,
          purchasesDefaultLineAmountType,
          salesDefaultAccountCode,
          purchasesDefaultAccountCode,
        },
      );
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

export default CreateContactTool;
