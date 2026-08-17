import type { TripExpenseRow, TripReport } from "./types";

const TRANSFER_KEY = "keihi-seisan:trip-report-transfer";
const REPORTS_KEY = "keihi-seisan:trip-reports";

function isBrowser() {
  return typeof window !== "undefined";
}

/**
 * 経費精算PDF作成画面でチェックした明細を、出張報告書へ渡すための
 * 一時的な受け渡し用バッファ。出張報告書側が読み取ったら消費して消す。
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

function readAllTripReports(): TripReport[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(REPORTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TripReport[]) : [];
  } catch {
    return [];
  }
}

function writeAllTripReports(reports: TripReport[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    // 保存できなくてもアプリ全体には影響させない
  }
}

/** 保存済みの出張報告書を、更新日時の新しい順で返す。 */
export function listTripReports(): TripReport[] {
  return [...readAllTripReports()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTripReport(id: string): TripReport | null {
  return readAllTripReports().find((r) => r.id === id) ?? null;
}

/** idが一致すれば更新、なければ新規追加する(自動保存用)。 */
export function saveTripReport(report: TripReport): void {
  const reports = readAllTripReports();
  const index = reports.findIndex((r) => r.id === report.id);
  if (index === -1) {
    reports.push(report);
  } else {
    reports[index] = report;
  }
  writeAllTripReports(reports);
}

export function deleteTripReport(id: string): void {
  writeAllTripReports(readAllTripReports().filter((r) => r.id !== id));
}

/**
 * スプレッドシートから取得した出張報告書を、ローカルの保存内容とidで突き合わせてマージする。
 * ローカルに存在しないもの、またはリモート側の方が新しい(updatedAtが新しい)ものだけを取り込む。
 * ブラウザのlocalStorageが失われた場合や別ブラウザで開いた場合の復元に使う。
 */
export function mergeRemoteTripReports(remote: TripReport[]): void {
  if (remote.length === 0) return;
  const reports = readAllTripReports();
  const byId = new Map(reports.map((r) => [r.id, r]));
  for (const r of remote) {
    const existing = byId.get(r.id);
    if (!existing || r.updatedAt > existing.updatedAt) {
      byId.set(r.id, r);
    }
  }
  writeAllTripReports(Array.from(byId.values()));
}
