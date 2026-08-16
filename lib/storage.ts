import type { Transaction } from "./types";

const GAS_URL_KEY = "keihi-seisan:gas-url";
const DRAFT_KEY = "keihi-seisan:draft-transactions";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getGasUrl(): string {
  if (!isBrowser()) return "";
  return window.localStorage.getItem(GAS_URL_KEY) ?? "";
}

export function setGasUrl(url: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(GAS_URL_KEY, url.trim());
}

export function clearGasUrl(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(GAS_URL_KEY);
}

export function saveDraftTransactions(transactions: Transaction[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(transactions));
  } catch {
    // localStorage が使えない/容量超過の場合は下書き保存を諦める(アプリの主機能には影響しない)
  }
}

export function loadDraftTransactions(): Transaction[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Transaction[]) : [];
  } catch {
    return [];
  }
}

export function clearDraftTransactions(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(DRAFT_KEY);
}
