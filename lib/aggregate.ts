import { BILLABLE_ORGANIZATIONS } from "./types";
import type { AggregationResult, OrganizationSummary, Transaction } from "./types";

function toDateOnly(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * 締め日(1-31)と対象年月から、集計期間 [開始日, 終了日] を算出する。
 * 例: 締め日=15, 対象年月=2026-08 -> 2026-07-16 〜 2026-08-15
 * 締め日が月末(31等)を超える月は、その月の末日に丸める。
 */
export function computePeriod(
  closingDay: number,
  targetYearMonth: string // "YYYY-MM"
): { periodStart: string; periodEnd: string } {
  const [yearStr, monthStr] = targetYearMonth.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-11

  const endDay = Math.min(closingDay, lastDayOfMonth(year, monthIndex));
  const periodEndDate = toDateOnly(year, monthIndex, endDay);

  const prevMonthIndex = monthIndex - 1;
  const prevYear = prevMonthIndex < 0 ? year - 1 : year;
  const normalizedPrevMonthIndex = (prevMonthIndex + 12) % 12;
  const prevEndDay = Math.min(closingDay, lastDayOfMonth(prevYear, normalizedPrevMonthIndex));
  const prevPeriodEndDate = toDateOnly(prevYear, normalizedPrevMonthIndex, prevEndDay);
  const periodStartDate = new Date(prevPeriodEndDate);
  periodStartDate.setUTCDate(periodStartDate.getUTCDate() + 1);

  return {
    periodStart: formatISODate(periodStartDate),
    periodEnd: formatISODate(periodEndDate),
  };
}

export function filterByPeriod(
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string
): Transaction[] {
  return transactions.filter((t) => t.date >= periodStart && t.date <= periodEnd);
}

export function aggregateByOrganization(
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string
): AggregationResult {
  const inPeriod = filterByPeriod(transactions, periodStart, periodEnd);

  const byOrganization: OrganizationSummary[] = BILLABLE_ORGANIZATIONS.map((org) => {
    const orgTransactions = inPeriod
      .filter((t) => t.organization === org.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      organization: org.id,
      label: org.label,
      total: orgTransactions.reduce((sum, t) => sum + t.amount, 0),
      count: orgTransactions.length,
      transactions: orgTransactions,
    };
  });

  const grandTotal = byOrganization.reduce((sum, o) => sum + o.total, 0);

  return { periodStart, periodEnd, grandTotal, byOrganization };
}
