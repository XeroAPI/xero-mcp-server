import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ReportWithRow } from "xero-node";
import { ListProfitAndLossParams } from "../types/list-profit-and-loss-params.js";

export interface PeriodReport {
  periodLabel: string;
  fromDate: string;
  toDate: string;
  report: ReportWithRow;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, monthOneIndexed: number): number {
  return new Date(year, monthOneIndexed, 0).getDate();
}

function parseAnchor(toDate: string | undefined): { year: number; month: number } {
  if (toDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDate);
    if (match) {
      return { year: Number(match[1]), month: Number(match[2]) };
    }
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function shiftMonth(year: number, month: number, deltaMonths: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + deltaMonths;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return { year: newYear, month: newMonth };
}

interface PeriodRange {
  from: string;
  to: string;
  label: string;
}

function computeMonthRanges(toDate: string | undefined, count: number): PeriodRange[] {
  const anchor = parseAnchor(toDate);
  const ranges: PeriodRange[] = [];
  for (let i = 0; i < count; i++) {
    const { year, month } = shiftMonth(anchor.year, anchor.month, -i);
    const lastDay = lastDayOfMonth(year, month);
    ranges.push({
      from: `${year}-${pad2(month)}-01`,
      to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
    });
  }
  return ranges.reverse();
}

function computeQuarterRanges(toDate: string | undefined, count: number): PeriodRange[] {
  const anchor = parseAnchor(toDate);
  const anchorQuarterEndMonth = Math.ceil(anchor.month / 3) * 3;
  const ranges: PeriodRange[] = [];
  for (let i = 0; i < count; i++) {
    const endShift = -i * 3;
    const { year: endYear, month: endMonth } = shiftMonth(
      anchor.year,
      anchorQuarterEndMonth,
      endShift,
    );
    const { year: startYear, month: startMonth } = shiftMonth(endYear, endMonth, -2);
    const lastDay = lastDayOfMonth(endYear, endMonth);
    const quarterIndex = Math.ceil(endMonth / 3);
    ranges.push({
      from: `${startYear}-${pad2(startMonth)}-01`,
      to: `${endYear}-${pad2(endMonth)}-${pad2(lastDay)}`,
      label: `Q${quarterIndex} ${endYear}`,
    });
  }
  return ranges.reverse();
}

function computeYearRanges(toDate: string | undefined, count: number): PeriodRange[] {
  const anchor = parseAnchor(toDate);
  const ranges: PeriodRange[] = [];
  for (let i = 0; i < count; i++) {
    const year = anchor.year - i;
    ranges.push({
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: `${year}`,
    });
  }
  return ranges.reverse();
}

async function fetchSinglePeriod(
  params: ListProfitAndLossParams,
  fromDate: string,
  toDate: string,
): Promise<ReportWithRow | null> {
  const response = await xeroClient.accountingApi.getReportProfitAndLoss(
    xeroClient.tenantId,
    fromDate,
    toDate,
    undefined,
    undefined,
    params.trackingCategoryID,
    params.trackingCategoryID2,
    params.trackingOptionID,
    params.trackingOptionID2,
    params.standardLayout,
    params.paymentsOnly,
    getClientHeaders(),
  );
  return response.body.reports?.[0] ?? null;
}

async function fetchAsRequested(
  params: ListProfitAndLossParams,
): Promise<ReportWithRow | null> {
  const response = await xeroClient.accountingApi.getReportProfitAndLoss(
    xeroClient.tenantId,
    params.fromDate,
    params.toDate,
    params.periods,
    params.timeframe,
    params.trackingCategoryID,
    params.trackingCategoryID2,
    params.trackingOptionID,
    params.trackingOptionID2,
    params.standardLayout,
    params.paymentsOnly,
    getClientHeaders(),
  );
  return response.body.reports?.[0] ?? null;
}

function rangesForTimeframe(
  timeframe: NonNullable<ListProfitAndLossParams["timeframe"]>,
  toDate: string | undefined,
  count: number,
): PeriodRange[] {
  switch (timeframe) {
    case "MONTH":
      return computeMonthRanges(toDate, count);
    case "QUARTER":
      return computeQuarterRanges(toDate, count);
    case "YEAR":
      return computeYearRanges(toDate, count);
  }
}

export async function listXeroProfitAndLoss(
  params: ListProfitAndLossParams,
): Promise<XeroClientResponse<PeriodReport[]>> {
  try {
    await xeroClient.authenticate();

    const wantsMultiPeriod =
      (params.periods ?? 0) >= 1 && Boolean(params.timeframe);

    if (wantsMultiPeriod && params.timeframe) {
      const totalPeriods = (params.periods ?? 0) + 1;
      const ranges = rangesForTimeframe(
        params.timeframe,
        params.toDate,
        totalPeriods,
      );

      const reports = await Promise.all(
        ranges.map(async (range) => {
          const report = await fetchSinglePeriod(params, range.from, range.to);
          return { range, report };
        }),
      );

      const failed = reports.find((r) => !r.report);
      if (failed) {
        return {
          result: null,
          isError: true,
          error: `Failed to fetch profit and loss data for ${failed.range.label} (${failed.range.from} to ${failed.range.to}).`,
        };
      }

      return {
        result: reports.map(({ range, report }) => ({
          periodLabel: range.label,
          fromDate: range.from,
          toDate: range.to,
          report: report as ReportWithRow,
        })),
        isError: false,
        error: null,
      };
    }

    const report = await fetchAsRequested(params);
    if (!report) {
      return {
        result: null,
        isError: true,
        error: "Failed to fetch profit and loss data from Xero.",
      };
    }

    return {
      result: [
        {
          periodLabel:
            params.fromDate && params.toDate
              ? `${params.fromDate} to ${params.toDate}`
              : "Report",
          fromDate: params.fromDate ?? "",
          toDate: params.toDate ?? "",
          report,
        },
      ],
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
