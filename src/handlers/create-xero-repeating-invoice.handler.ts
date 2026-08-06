import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import {
  RepeatingInvoice,
  Schedule,
  LineItemTracking,
  CurrencyCode,
  LineAmountTypes,
} from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export type LineAmountTypeInput = "EXCLUSIVE" | "INCLUSIVE" | "NO_TAX";

function mapLineAmountType(
  input?: LineAmountTypeInput,
): LineAmountTypes | undefined {
  switch (input) {
    case "EXCLUSIVE":
      return LineAmountTypes.Exclusive;
    case "INCLUSIVE":
      return LineAmountTypes.Inclusive;
    case "NO_TAX":
      return LineAmountTypes.NoTax;
    default:
      return undefined;
  }
}

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
  startDate: string;
  dueDate?: number;
  dueDateType?: string;
  endDate?: string;
}

export interface CreateRepeatingInvoiceInput {
  contactId: string;
  schedule: RepeatingInvoiceScheduleInput;
  lineItems: RepeatingInvoiceLineItem[];
  type?: "ACCREC" | "ACCPAY";
  status?: "DRAFT" | "AUTHORISED";
  reference?: string;
  brandingThemeId?: string;
  currencyCode?: string;
  lineAmountType?: LineAmountTypeInput;
  approvedForSending?: boolean;
  sendCopy?: boolean;
  markAsSent?: boolean;
  includePDF?: boolean;
}

function buildSchedule(input: RepeatingInvoiceScheduleInput): Schedule {
  return {
    period: input.period,
    unit: Schedule.UnitEnum[input.unit as keyof typeof Schedule.UnitEnum],
    startDate: input.startDate,
    dueDate: input.dueDate,
    dueDateType: input.dueDateType
      ? Schedule.DueDateTypeEnum[
          input.dueDateType as keyof typeof Schedule.DueDateTypeEnum
        ]
      : undefined,
    endDate: input.endDate,
  };
}

function buildRepeatingInvoice(
  input: CreateRepeatingInvoiceInput,
): RepeatingInvoice {
  return {
    type:
      RepeatingInvoice.TypeEnum[
        (input.type ?? "ACCREC") as keyof typeof RepeatingInvoice.TypeEnum
      ],
    contact: { contactID: input.contactId },
    schedule: buildSchedule(input.schedule),
    lineItems: input.lineItems,
    status:
      RepeatingInvoice.StatusEnum[
        (input.status ?? "DRAFT") as keyof typeof RepeatingInvoice.StatusEnum
      ],
    reference: input.reference,
    brandingThemeID: input.brandingThemeId,
    currencyCode: input.currencyCode
      ? CurrencyCode[input.currencyCode as keyof typeof CurrencyCode]
      : undefined,
    lineAmountTypes: mapLineAmountType(input.lineAmountType),
    approvedForSending: input.approvedForSending,
    sendCopy: input.sendCopy,
    markAsSent: input.markAsSent,
    includePDF: input.includePDF,
  };
}

/**
 * Create a repeating-invoice template in Xero
 */
export async function createXeroRepeatingInvoice(
  input: CreateRepeatingInvoiceInput,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    await xeroClient.authenticate();

    const repeatingInvoice = buildRepeatingInvoice(input);

    const response = await xeroClient.accountingApi.createRepeatingInvoices(
      xeroClient.tenantId,
      { repeatingInvoices: [repeatingInvoice] },
      true, // summarizeErrors
      undefined, // idempotencyKey
      getClientHeaders(),
    );

    const created = response.body.repeatingInvoices?.[0];
    if (!created) {
      throw new Error("Repeating invoice creation failed.");
    }

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
