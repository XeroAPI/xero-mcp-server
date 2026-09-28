import { LineAmountTypes, RepeatingInvoice, Schedule } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { mapLineAmountTypes } from "../helpers/map-line-amount-types.js";
import {
  RepeatingInvoiceLineAmountTypes,
  RepeatingInvoiceLineItem,
  RepeatingInvoiceScheduleInput,
  RepeatingInvoiceStatus,
  RepeatingInvoiceType,
} from "../types/repeating-invoice.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface CreateRepeatingInvoiceParams {
  contactId: string;
  lineItems: RepeatingInvoiceLineItem[];
  schedule: RepeatingInvoiceScheduleInput;
  type?: RepeatingInvoiceType;
  reference?: string;
  status?: Exclude<RepeatingInvoiceStatus, "DELETED">;
  lineAmountTypes?: RepeatingInvoiceLineAmountTypes;
}

function mapDueDateType(
  dueDateType: RepeatingInvoiceScheduleInput["dueDateType"],
): Schedule.DueDateTypeEnum {
  return Schedule.DueDateTypeEnum[dueDateType];
}

async function createRepeatingInvoice(
  params: CreateRepeatingInvoiceParams,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const repeatingInvoice: RepeatingInvoice = {
    type:
      params.type === "ACCPAY"
        ? RepeatingInvoice.TypeEnum.ACCPAY
        : RepeatingInvoice.TypeEnum.ACCREC,
    contact: {
      contactID: params.contactId,
    },
    lineItems: params.lineItems,
    schedule: {
      period: params.schedule.period,
      unit:
        params.schedule.unit === "WEEKLY"
          ? Schedule.UnitEnum.WEEKLY
          : Schedule.UnitEnum.MONTHLY,
      dueDate: params.schedule.dueDate,
      dueDateType: mapDueDateType(params.schedule.dueDateType),
      startDate: params.schedule.startDate,
      endDate: params.schedule.endDate,
    },
    reference: params.reference,
    status:
      params.status === "AUTHORISED"
        ? RepeatingInvoice.StatusEnum.AUTHORISED
        : RepeatingInvoice.StatusEnum.DRAFT,
    lineAmountTypes:
      mapLineAmountTypes(params.lineAmountTypes) ?? LineAmountTypes.Exclusive,
  };

  const response = await xeroClient.accountingApi.createRepeatingInvoices(
    xeroClient.tenantId,
    {
      repeatingInvoices: [repeatingInvoice],
    },
    true,
    undefined,
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

/**
 * Create a new repeating invoice template in Xero
 */
export async function createXeroRepeatingInvoice(
  params: CreateRepeatingInvoiceParams,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const created = await createRepeatingInvoice(params);

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
