import type { AggregationResult } from "./types";
import { buildSummaryHtml, type PdfMeta } from "./pdf-template";
import { renderHtmlToPdf } from "./html-to-pdf";

/**
 * 集計結果を1枚(必要に応じて複数ページ)の経費精算PDFとして出力する。
 */
export async function generateExpensePdf(
  result: AggregationResult,
  meta: PdfMeta
): Promise<void> {
  const html = buildSummaryHtml(result, meta);
  await renderHtmlToPdf(html, `経費精算書_${meta.issueDate || "未指定"}.pdf`);
}
