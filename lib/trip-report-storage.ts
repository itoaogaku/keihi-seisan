import type { TripExpenseRow, TripReport } from "./types";

const TRANSFER_KEY = "keihi-seisan:trip-report-transfer";
const DRAFT_KEY = "keihi-seisan:trip-report-draft";

function isBrowser() {
  return typeof window !== "undefined";
}

/**
 * 経費精算PDF作成画面でチェックした明細を、出張報告書タブへ渡すための
 * 一時的な受け渡し用バッファ。出張報告書タブ側が読み取ったら消費して消す。
 */
export function pushTripReportTransfer(items: TripExpenseRow[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TRANSFER_KEY, JSON.stringify(items));
  } catch {
    // 転記できなくてもアプリ全体には影響させない
  }
}

export function popTripReportTransfer(): TripExpenseRow[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(TRANSFER_KEY);
  if (!raw) return [];
  window.localStorage.removeItem(TRANSFER_KEY);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TripExpenseRow[]) : [];
  } catch {
    return [];
  }
}

export function saveTripReportDraft(report: TripReport): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(report));
  } catch {
    // 下書き保存できなくてもアプリ全体には影響させない
  }
}

export function loadTripReportDraft(): TripReport | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TripReport;
  } catch {
    return null;
  }
}
