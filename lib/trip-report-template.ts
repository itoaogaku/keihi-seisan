import type { TripReport } from "./types";

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDateJpLong(iso: string): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts.map(Number);
  return `${y}年${m}月${d}日`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

const infoLabelStyle =
  "width:110px; background:#f3f4f6; font-weight:600; padding:10px 12px; border:1px solid #333; vertical-align:top;";
const infoValueStyle = "padding:10px 12px; border:1px solid #333;";

const expenseHeadStyle =
  "padding:8px; border:1px solid #333; background:#e5e7eb; font-weight:600; text-align:center;";
const expenseCellStyle = "padding:6px 10px; border:1px solid #333;";

/**
 * 出張報告書のPDF化対象HTMLを組み立てる。写真の様式(日時・氏名の欄、
 * 日時/場所/目的/報告内容の表、出張経費の表)にあわせている。
 */
export function buildTripReportHtml(report: TripReport, total: number): string {
  const expenseRows =
    report.expenses.length > 0
      ? report.expenses
          .map(
            (e) => `
        <tr>
          <td style="${expenseCellStyle} white-space:nowrap;">${formatDateJpLong(e.date)}</td>
          <td style="${expenseCellStyle}" colspan="2">${escapeHtml(e.description)}</td>
          <td style="${expenseCellStyle} text-align:right;">${yen(e.amount)}</td>
          <td style="${expenseCellStyle}">${escapeHtml(e.note)}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="5" style="${expenseCellStyle} text-align:center; color:#888;">経費はありません</td></tr>`;

  return `
  <div style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', sans-serif; color:#1a1a1a; padding:36px; width:730px; box-sizing:border-box; background:#ffffff;">
    <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
      <table style="border-collapse:collapse; font-size:13px;">
        <tr>
          <td style="${infoLabelStyle} width:80px;">日時</td>
          <td style="${infoValueStyle} width:170px;">${formatDateJpLong(report.reportDate)}</td>
        </tr>
        <tr>
          <td style="${infoLabelStyle} width:80px;">氏名</td>
          <td style="${infoValueStyle} width:170px;">${escapeHtml(report.applicantName || "-")}</td>
        </tr>
      </table>
    </div>

    <h1 style="text-align:center; font-size:24px; margin:0 0 24px 0;">出張報告書</h1>

    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:24px;">
      <tr>
        <td style="${infoLabelStyle}">日時</td>
        <td style="${infoValueStyle}">${formatDateJpLong(report.tripDate)}</td>
      </tr>
      <tr>
        <td style="${infoLabelStyle}">場所</td>
        <td style="${infoValueStyle}">${escapeHtml(report.location || "-")}</td>
      </tr>
      <tr>
        <td style="${infoLabelStyle}">目的</td>
        <td style="${infoValueStyle}">${escapeHtml(report.purpose || "-")}</td>
      </tr>
      <tr>
        <td style="${infoLabelStyle}">報告内容</td>
        <td style="${infoValueStyle} line-height:1.7;">${nl2br(report.content) || "-"}</td>
      </tr>
    </table>

    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <tr>
        <td colspan="5" style="padding:8px; border:1px solid #333; background:#d1d5db; font-weight:600; text-align:center;">出張経費</td>
      </tr>
      <tr>
        <th style="${expenseHeadStyle} width:100px;">日付</th>
        <th style="${expenseHeadStyle}" colspan="2">内容</th>
        <th style="${expenseHeadStyle} width:110px;">金額</th>
        <th style="${expenseHeadStyle} width:120px;">備考</th>
      </tr>
      ${expenseRows}
      <tr>
        <td colspan="3" style="${expenseCellStyle} text-align:center; font-weight:600; background:#f3f4f6;">立替金額合計</td>
        <td style="${expenseCellStyle} text-align:right; font-weight:600;">${yen(total)}</td>
        <td style="${expenseCellStyle}"></td>
      </tr>
    </table>
  </div>`;
}
