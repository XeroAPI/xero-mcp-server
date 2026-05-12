import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import {
  CurrencyCode,
  LineAmountTypes,
  LineItemTracking,
  RepeatingInvoice,
  Schedule,
} from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { postAuditNote } from "../helpers/post-audit-note.js";

export interface RepeatingInvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

export interface RepeatingInvoiceScheduleInput {
  period: number;
  unit: "WEEKLY" | "MONTHLY";
  dueDate: number;
  dueDateType:
    | "DAYSAFTERBILLDATE"
    | "DAYSAFTERBILLMONTH"
    | "DAYSAFTERINVOICEDATE"
    | "DAYSAFTERINVOICEMONTH"
    | "OFCURRENTMONTH"
    | "OFFOLLOWINGMONTH";
  startDate?: string;
  endDate?: string;
}

export interface CreateRepeatingInvoiceInput {
  contactId: string;
  type: "ACCREC" | "ACCPAY";
  schedule: RepeatingInvoiceScheduleInput;
  lineItems: RepeatingInvoiceLineItem[];
  reference?: string;
  brandingThemeID?: string;
  currencyCode?: string;
  lineAmountTypes?: "INCLUSIVE" | "EXCLUSIVE" | "NOTAX";
  status?: "DRAFT" | "AUTHORISED";
  sendCopy?: boolean;
  markAsSent?: boolean;
  includePDF?: boolean;
}

function buildSchedule(input: RepeatingInvoiceScheduleInput): Schedule {
  return {
    period: input.period,
    unit: Schedule.UnitEnum[input.unit],
    dueDate: input.dueDate,
    dueDateType: Schedule.DueDateTypeEnum[input.dueDateType],
    startDate: input.startDate,
    endDate: input.endDate,
  };
}

function mapLineAmountTypes(
  value: "INCLUSIVE" | "EXCLUSIVE" | "NOTAX",
): LineAmountTypes {
  if (value === "INCLUSIVE") return LineAmountTypes.Inclusive;
  if (value === "EXCLUSIVE") return LineAmountTypes.Exclusive;
  return LineAmountTypes.NoTax;
}

export function buildRepeatingInvoiceCurrency(
  raw: string | undefined,
): CurrencyCode | undefined {
  if (raw === undefined) return undefined;
  const code = raw.toUpperCase() as keyof typeof CurrencyCode;
  return CurrencyCode[code];
}

async function createRepeatingInvoice(
  input: CreateRepeatingInvoiceInput,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const repeatingInvoice: RepeatingInvoice = {
    type: RepeatingInvoice.TypeEnum[input.type],
    contact: { contactID: input.contactId },
    schedule: buildSchedule(input.schedule),
    lineItems: input.lineItems,
    reference: input.reference,
    brandingThemeID: input.brandingThemeID,
    status: input.status
      ? RepeatingInvoice.StatusEnum[input.status]
      : RepeatingInvoice.StatusEnum.DRAFT,
    sendCopy: input.sendCopy,
    markAsSent: input.markAsSent,
    includePDF: input.includePDF,
  };

  const currency = buildRepeatingInvoiceCurrency(input.currencyCode);
  if (currency !== undefined) repeatingInvoice.currencyCode = currency;
  if (input.lineAmountTypes !== undefined) {
    repeatingInvoice.lineAmountTypes = mapLineAmountTypes(input.lineAmountTypes);
  }

  const response = await xeroClient.accountingApi.createRepeatingInvoices(
    xeroClient.tenantId,
    { repeatingInvoices: [repeatingInvoice] },
    true, // summarizeErrors
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

export async function createXeroRepeatingInvoice(
  input: CreateRepeatingInvoiceInput,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const created = await createRepeatingInvoice(input);

    if (!created) {
      throw new Error("Repeating invoice creation failed.");
    }

    await postAuditNote("RepeatingInvoice", created.repeatingInvoiceID, "Created");


    return {
      result: created,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
