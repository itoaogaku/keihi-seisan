import type { AggregationResult } from "./types";
import { PAYMENT_METHOD_LABELS } from "./types";

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDateJp(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}/${m}/${d}`;
}

export interface PdfMeta {
  issueDate: string; // ISO date (YYYY-MM-DD)
  note: string;
}

/**
 * PDF化対象のHTMLを文字列で組み立てる。
 * html2canvas でそのままラスタライズするため、Tailwindクラスではなく
 * インラインスタイルで完結させている(外部CSS読み込みタイミングに依存しないため)。
 */
export function buildSummaryHtml(result: AggregationResult, meta: PdfMeta): string {
  const { grandTotal, byOrganization } = result;

  // PDF上では、金額が0円の請求先組織は内訳に表示しない
  const nonZeroOrganizations = byOrganization.filter((org) => org.total !== 0);

  const orgRows = nonZeroOrganizations
    .map(
      (org) => `
      <tr>
        <td style="${cellStyle}">${escapeHtml(org.label)}</td>
        <td style="${cellStyle} text-align:right;">${org.count}件</td>
        <td style="${cellStyle} text-align:right; font-weight:600;">${yen(org.total)}</td>
      </tr>`
    )
    .join("");

  const detailRows = byOrganization
    .flatMap((org) =>
      org.transactions.map(
        (t) => `
        <tr>
          <td style="${detailCellStyle}">${formatDateJp(t.date)}</td>
          <td style="${detailCellStyle}">${escapeHtml(org.label)}</td>
          <td style="${detailCellStyle}">${PAYMENT_METHOD_LABELS[t.paymentMethod]}</td>
          <td style="${detailCellStyle}">${escapeHtml(t.description)}</td>
          <td style="${detailCellStyle}">${escapeHtml(t.memo || "-")}</td>
          <td style="${detailCellStyle} text-align:right;">${yen(t.amount)}</td>
        </tr>`
      )
    )
    .join("");

  return `
  <div style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', sans-serif; color:#1a1a1a; padding:32px; width:730px; box-sizing:border-box; background:#ffffff;">
    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #1a1a1a; padding-bottom:16px; margin-bottom:20px;">
      <div>
        <h1 style="font-size:22px; margin:0;">経費精算書</h1>
      </div>
      <div style="text-align:right; font-size:12px; color:#555;">
        <div>発行日: ${meta.issueDate ? formatDateJp(meta.issueDate) : "-"}</div>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; background:#f3f4f6; border-radius:8px; padding:16px 20px; margin-bottom:24px;">
      <span style="font-size:14px; font-weight:600;">合計請求額</span>
      <span style="font-size:26px; font-weight:700;">${yen(grandTotal)}</span>
    </div>

    <h2 style="font-size:14px; margin:0 0 8px 0;">組織別内訳</h2>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:12px;">
      <thead>
        <tr>
          <th style="${headStyle}">請求先組織</th>
          <th style="${headStyle} text-align:right;">件数</th>
          <th style="${headStyle} text-align:right;">金額</th>
        </tr>
      </thead>
      <tbody>${orgRows || emptyOrgRow}</tbody>
    </table>

    <h2 style="font-size:14px; margin:0 0 8px 0;">明細一覧</h2>
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead>
        <tr>
          <th style="${detailHeadStyle}">利用日</th>
          <th style="${detailHeadStyle}">請求先組織</th>
          <th style="${detailHeadStyle}">方法</th>
          <th style="${detailHeadStyle}">内容</th>
          <th style="${detailHeadStyle}">メモ</th>
          <th style="${detailHeadStyle} text-align:right;">金額</th>
        </tr>
      </thead>
      <tbody>${detailRows || emptyRow}</tbody>
    </table>

    ${
      meta.note
        ? `<div style="margin-top:20px; font-size:11px; color:#555;"><strong>備考:</strong> ${escapeHtml(meta.note)}</div>`
        : ""
    }
  </div>`;
}

const headStyle =
  "text-align:left; padding:8px; background:#1a1a1a; color:#fff; font-weight:600;";
const detailHeadStyle =
  "text-align:left; padding:6px 8px; background:#e5e7eb; color:#1a1a1a; font-weight:600; border-bottom:1px solid #d1d5db;";
const cellStyle = "padding:8px; border-bottom:1px solid #e5e7eb;";
const detailCellStyle = "padding:5px 8px; border-bottom:1px solid #eef0f2;";
const emptyRow = `<tr><td colspan="6" style="${detailCellStyle} text-align:center; color:#888;">明細がありません</td></tr>`;
const emptyOrgRow = `<tr><td colspan="3" style="${cellStyle} text-align:center; color:#888;">明細がありません</td></tr>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
