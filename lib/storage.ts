import type { Transaction } from "./types";

const GAS_URL_KEY = "keihi-seisan:gas-url";
const DRAFT_KEY = "keihi-seisan:draft-transactions";
const EDIT_BUFFER_KEY = "keihi-seisan:edit-buffer";

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
    if (!Array.isArray(parsed)) return [];
    // 旧バージョンの下書き(memo/paymentMethod未対応)を読み込んだ場合の補完
    return (parsed as Partial<Transaction>[]).map((t) => ({
      id: t.id ?? crypto.randomUUID(),
      date: t.date ?? "",
      description: t.description ?? "",
      amount: t.amount ?? 0,
      organization: t.organization ?? null,
      memo: t.memo ?? "",
      paymentMethod: t.paymentMethod ?? "card",
    }));
  } catch {
    return [];
  }
}

export function clearDraftTransactions(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(DRAFT_KEY);
}

export interface EditBuffer {
  transactions: Transaction[];
  issueDate: string;
  /** 編集元エントリの保存日時。再保存時にGAS側の元の行を置き換えるために使う。 */
  savedAt: string;
}

/** 一覧画面の「編集」から/newへ、編集対象のデータを1回だけ受け渡すためのバッファ。 */
export function pushEditBuffer(buffer: EditBuffer): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(EDIT_BUFFER_KEY, JSON.stringify(buffer));
  } catch {
    // 受け渡しに失敗しても、/newは空の状態から開始するだけなのでアプリ全体には影響させない
  }
}

export function popEditBuffer(): EditBuffer | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(EDIT_BUFFER_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(EDIT_BUFFER_KEY);
  try {
    return JSON.parse(raw) as EditBuffer;
  } catch {
    return null;
  }
}
