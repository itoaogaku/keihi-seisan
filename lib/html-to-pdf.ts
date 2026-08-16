const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const MARGIN_PT = 24;

/**
 * 渡されたHTML文字列をブラウザ上でレンダリング・ラスタライズし、
 * 必要に応じて複数ページに分割してA4のPDFとして保存する。
 * 日本語フォントを埋め込む必要がないよう、テキストではなく
 * 画像としてPDFに貼り付ける方式を採用している。
 */
export async function renderHtmlToPdf(html: string, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const container = document.createElement("div");
  container.className = "pdf-render-root";
  container.innerHTML = html;
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

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
