import Papa from "papaparse";
import type { Transaction } from "./types";

const DATE_HEADER_PATTERNS = ["利用日", "ご利用日", "日付", "取引日", "date"];
const DESCRIPTION_HEADER_PATTERNS = [
  "利用店名",
  "利用店名及び商品名",
  "ご利用先",
  "摘要",
  "内容",
  "店名",
  "description",
];
const AMOUNT_HEADER_PATTERNS = [
  "利用金額",
  "ご利用金額",
  "金額",
  "支払金額",
  "amount",
];

function normalizeHeader(header: string): string {
  return header.replace(/[\s　]/g, "").toLowerCase();
}

function findColumnIndex(headers: string[], patterns: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const pattern of patterns) {
    const idx = normalized.findIndex((h) => h.includes(normalizeHeader(pattern)));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[¥,\s円]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // 2024/1/15, 2024-01-15, 2024.1.15
  let m = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 1/15 (年省略、直近の年を仮定するのは危険なので現在年を採用)
  m = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})$/);
  if (m) {
    const [, mo, d] = m;
    const year = new Date().getFullYear();
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 令和6年1月15日 のような和暦は非対応。パース不能ならそのまま返す
  return null;
}

export interface ParseResult {
  transactions: Transaction[];
  skippedRows: number;
}

/**
 * クレジットカード会社ごとにCSVの列名・列順はまちまちなため、
 * ヘッダー名から日付・内容・金額の列を推測する。
 * ヘッダーが見つからない場合は「先頭3列 = 日付・内容・金額」を仮定する。
 */
export function parseTransactionsFromText(text: string): ParseResult {
  const result = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: true,
  });

  const rows = result.data.filter((row) => row.length > 0);
  if (rows.length === 0) {
    return { transactions: [], skippedRows: 0 };
  }

  const headerRow = rows[0];
  let dateIdx = findColumnIndex(headerRow, DATE_HEADER_PATTERNS);
  let descIdx = findColumnIndex(headerRow, DESCRIPTION_HEADER_PATTERNS);
  let amountIdx = findColumnIndex(headerRow, AMOUNT_HEADER_PATTERNS);

  let dataRows: string[][];
  const looksLikeHeader = dateIdx !== -1 || descIdx !== -1 || amountIdx !== -1;

  if (looksLikeHeader) {
    dataRows = rows.slice(1);
    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;
    if (amountIdx === -1) amountIdx = 2;
  } else {
    // ヘッダーなし: 先頭列から 日付・内容・金額 と仮定
    dataRows = rows;
    dateIdx = 0;
    descIdx = 1;
    amountIdx = 2;
  }

  const transactions: Transaction[] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    const rawDate = row[dateIdx] ?? "";
    const rawDesc = row[descIdx] ?? "";

    const date = parseDate(rawDate);
    // 想定した列に金額がない場合(例: 「ご本人」「1回払い」など支払方法の列が
    // 間に挟まる明細書式)は、その右側の列を順に走査して最初に数値として
    // 解釈できた列を金額とみなす。
    let amount: number | null = null;
    for (let col = amountIdx; col < row.length; col += 1) {
      amount = parseAmount(row[col] ?? "");
      if (amount !== null) break;
    }

    if (!date || amount === null || rawDesc.trim() === "") {
      skippedRows += 1;
      continue;
    }

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description: rawDesc.trim(),
      amount,
      organization: null,
      memo: "",
      paymentMethod: "card",
    });
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return { transactions, skippedRows };
}
