import Papa from "papaparse";
import type { HistoryRecord } from "./types";

const BOM = "﻿";

const COLUMNS: Array<{ key: keyof HistoryRecord; label: string }> = [
  { key: "savedAt", label: "保存日時" },
  { key: "status", label: "保存区分" },
  { key: "issueDate", label: "発行日" },
  { key: "date", label: "利用日" },
  { key: "paymentMethod", label: "支払方法" },
  { key: "organization", label: "請求先組織" },
  { key: "description", label: "内容" },
  { key: "memo", label: "メモ" },
  { key: "amount", label: "金額" },
  { key: "sourceFile", label: "取込ファイル" },
];

/**
 * 画面の一覧に表示されている全レコードをそのままCSVとして書き出す。
 * ExcelでもJIS系アプリでも文字化けしないよう、UTF-8 BOM付きで出力する。
 */
export function exportHistoryToCsv(records: HistoryRecord[], filename: string): void {
  const rows = records.map((r) => COLUMNS.map((c) => String(r[c.key] ?? "")));
  const csv = Papa.unparse([COLUMNS.map((c) => c.label), ...rows]);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
