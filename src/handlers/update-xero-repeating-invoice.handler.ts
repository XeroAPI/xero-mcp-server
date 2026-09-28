import { RepeatingInvoice, Schedule } from "xero-node";
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

export interface UpdateRepeatingInvoiceParams {
  repeatingInvoiceId: string;
  contactId?: string;
  lineItems?: RepeatingInvoiceLineItem[];
  schedule?: Partial<RepeatingInvoiceScheduleInput>;
  type?: RepeatingInvoiceType;
  reference?: string;
  status?: RepeatingInvoiceStatus;
  lineAmountTypes?: RepeatingInvoiceLineAmountTypes;
}

async function getRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getRepeatingInvoice(
    xeroClient.tenantId,
    repeatingInvoiceId,
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

// Send a complete schedule: fill any field the caller did not supply from the
// existing template, so a period-only change keeps its due date and start date.
function mapSchedule(
  schedule: Partial<RepeatingInvoiceScheduleInput> | undefined,
  existing: Schedule | undefined,
): Schedule | undefined {
  if (!schedule) {
    return undefined;
  }

  return {
    period: schedule.period ?? existing?.period,
    unit: (schedule.unit as Schedule.UnitEnum | undefined) ?? existing?.unit,
    dueDate: schedule.dueDate ?? existing?.dueDate,
    dueDateType:
      (schedule.dueDateType as Schedule.DueDateTypeEnum | undefined) ??
      existing?.dueDateType,
    startDate: schedule.startDate ?? existing?.startDate,
    endDate: schedule.endDate ?? existing?.endDate,
  };
}

async function updateRepeatingInvoice(
  params: UpdateRepeatingInvoiceParams,
  existing: RepeatingInvoice,
): Promise<RepeatingInvoice | undefined> {
  const repeatingInvoice: RepeatingInvoice = {
    lineItems: params.lineItems,
    schedule: mapSchedule(params.schedule, existing.schedule),
    reference: params.reference,
    contact: params.contactId ? { contactID: params.contactId } : undefined,
    type: params.type as RepeatingInvoice.TypeEnum | undefined,
    status: params.status as RepeatingInvoice.StatusEnum | undefined,
    lineAmountTypes: mapLineAmountTypes(params.lineAmountTypes),
  };

  const response = await xeroClient.accountingApi.updateRepeatingInvoice(
    xeroClient.tenantId,
    params.repeatingInvoiceId,
    {
      repeatingInvoices: [repeatingInvoice],
    },
    undefined,
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

/**
 * Update an existing draft or authorised repeating invoice template in Xero
 */
export async function updateXeroRepeatingInvoice(
  params: UpdateRepeatingInvoiceParams,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const existing = await getRepeatingInvoice(params.repeatingInvoiceId);

    if (!existing) {
      return {
        result: null,
        isError: true,
        error: "Repeating invoice not found.",
      };
    }

    const currentStatus = existing.status;

    if (
      currentStatus !== RepeatingInvoice.StatusEnum.DRAFT &&
      currentStatus !== RepeatingInvoice.StatusEnum.AUTHORISED
    ) {
      return {
        result: null,
        isError: true,
        error: `Cannot update repeating invoice because it is ${currentStatus ?? "unknown"}. Only DRAFT and AUTHORISED repeating invoices can be updated.`,
      };
    }

    const updated = await updateRepeatingInvoice(params, existing);

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
