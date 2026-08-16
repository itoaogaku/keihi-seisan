import type { AggregationResult } from "./types";
import { buildSummaryHtml, type PdfMeta } from "./pdf-template";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const MARGIN_PT = 24;

/**
 * 集計結果を1枚(必要に応じて複数ページ)の経費精算PDFとして出力する。
 * ブラウザでHTMLをレンダリング後にラスタライズするため、
 * 日本語フォントの埋め込みなしで正しく日本語を表示できる。
 */
export async function generateExpensePdf(
  result: AggregationResult,
  meta: PdfMeta
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const container = document.createElement("div");
  container.className = "pdf-render-root";
  container.innerHTML = buildSummaryHtml(result, meta);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const usableWidth = A4_WIDTH_PT - MARGIN_PT * 2;
    const usableHeight = A4_HEIGHT_PT - MARGIN_PT * 2;

    const scaledHeight = (canvas.height * usableWidth) / canvas.width;
    const pageCount = Math.max(1, Math.ceil(scaledHeight / usableHeight));

    const pageCanvasHeightPx = Math.ceil(canvas.height / pageCount);

    for (let page = 0; page < pageCount; page += 1) {
      if (page > 0) pdf.addPage();

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = pageCanvasHeightPx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        page * pageCanvasHeightPx,
        canvas.width,
        pageCanvasHeightPx,
        0,
        0,
        canvas.width,
        pageCanvasHeightPx
      );

      const imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
      const sliceHeightPt = (pageCanvasHeightPx * usableWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", MARGIN_PT, MARGIN_PT, usableWidth, sliceHeightPt);
    }

    pdf.save(`経費精算書_${result.periodStart}_${result.periodEnd}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
