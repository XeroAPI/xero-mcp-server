import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import {
  LineAmountTypes,
  RepeatingInvoice,
  Schedule,
} from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import {
  buildRepeatingInvoiceCurrency,
  RepeatingInvoiceLineItem,
  RepeatingInvoiceScheduleInput,
} from "./create-xero-repeating-invoice.handler.js";

export interface UpdateRepeatingInvoiceInput {
  repeatingInvoiceID: string;
  contactId?: string;
  type?: "ACCREC" | "ACCPAY";
  schedule?: RepeatingInvoiceScheduleInput;
  lineItems?: RepeatingInvoiceLineItem[];
  reference?: string;
  brandingThemeID?: string;
  currencyCode?: string;
  lineAmountTypes?: "INCLUSIVE" | "EXCLUSIVE" | "NOTAX";
  status?: "DRAFT" | "AUTHORISED" | "DELETED";
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

async function updateRepeatingInvoice(
  input: UpdateRepeatingInvoiceInput,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const repeatingInvoice: RepeatingInvoice = {
    repeatingInvoiceID: input.repeatingInvoiceID,
  };

  if (input.type !== undefined) {
    repeatingInvoice.type = RepeatingInvoice.TypeEnum[input.type];
  }
  if (input.contactId !== undefined) {
    repeatingInvoice.contact = { contactID: input.contactId };
  }
  if (input.schedule !== undefined) {
    repeatingInvoice.schedule = buildSchedule(input.schedule);
  }
  if (input.lineItems !== undefined) {
    repeatingInvoice.lineItems = input.lineItems;
  }
  if (input.reference !== undefined) repeatingInvoice.reference = input.reference;
  if (input.brandingThemeID !== undefined) {
    repeatingInvoice.brandingThemeID = input.brandingThemeID;
  }
  const currency = buildRepeatingInvoiceCurrency(input.currencyCode);
  if (currency !== undefined) repeatingInvoice.currencyCode = currency;
  if (input.lineAmountTypes !== undefined) {
    repeatingInvoice.lineAmountTypes = mapLineAmountTypes(input.lineAmountTypes);
  }
  if (input.status !== undefined) {
    repeatingInvoice.status = RepeatingInvoice.StatusEnum[input.status];
  }
  if (input.sendCopy !== undefined) repeatingInvoice.sendCopy = input.sendCopy;
  if (input.markAsSent !== undefined) repeatingInvoice.markAsSent = input.markAsSent;
  if (input.includePDF !== undefined) repeatingInvoice.includePDF = input.includePDF;

  const response = await xeroClient.accountingApi.updateRepeatingInvoice(
    xeroClient.tenantId,
    input.repeatingInvoiceID,
    { repeatingInvoices: [repeatingInvoice] },
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

export async function updateXeroRepeatingInvoice(
  input: UpdateRepeatingInvoiceInput,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const updated = await updateRepeatingInvoice(input);

    if (!updated) {
      throw new Error("Repeating invoice update failed.");
    }

    return {
      result: updated,
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
