import { z } from "zod";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.");

export const pageSchema = z
  .number()
  .int()
  .min(1)
  .default(1);

export const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(500)
  .default(100);

export const trackingSchema = z
  .object({
    trackingCategoryID: z.string().uuid().optional(),
    trackingOptionID: z.string().uuid().optional(),
    name: z.string().optional(),
    option: z.string().optional(),
  })
  .refine(
    (value) =>
      Boolean(value.trackingCategoryID || value.name) &&
      Boolean(value.trackingOptionID || value.option),
    "Tracking requires a category ID/name and an option ID/name.",
  );

export const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().optional(),
  unitAmount: z.number().optional(),
  lineAmount: z.number().optional(),
  accountCode: z.string().optional(),
  accountID: z.string().uuid().optional(),
  taxType: z.string().optional(),
  taxAmount: z.number().optional(),
  itemCode: z.string().optional(),
  tracking: z.array(trackingSchema).max(2).optional(),
});

export const journalLineSchema = z.object({
  lineAmount: z.number().finite(),
  accountCode: z.string().optional(),
  accountID: z.string().uuid().optional(),
  description: z.string().optional(),
  taxType: z.string().optional(),
  tracking: z.array(trackingSchema).max(2).optional(),
});

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .optional()
  .describe("Stable retry key forwarded to Xero where supported.");

export const sourceSchema = z.object({
  reference: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  externalSourceId: z.string().optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const accountInputSchema = {
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(150),
  type: z.string().min(1),
  description: z.string().max(4000).optional(),
  taxType: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountType: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).optional(),
  enablePaymentsToAccount: z.boolean().optional(),
  showInExpenseClaims: z.boolean().optional(),
};

export const contactInputSchema = {
  name: z.string().min(1).max(255),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  emailAddress: z.string().email().optional(),
  phone: z.string().optional(),
  companyNumber: z.string().optional(),
  accountNumber: z.string().optional(),
  contactNumber: z.string().optional(),
  contactStatus: z.enum(["ACTIVE", "ARCHIVED", "GDPRREQUEST"]).optional(),
  defaultCurrency: z.string().length(3).optional(),
  salesDefaultAccountCode: z.string().optional(),
  purchasesDefaultAccountCode: z.string().optional(),
  accountsReceivableTaxType: z.string().optional(),
  accountsPayableTaxType: z.string().optional(),
  paymentTerms: z.record(z.string(), z.number()).optional(),
};

export const reportPeriodSchema = {
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
};
