import type { TripReport } from "./types";
import { buildTripReportHtml } from "./trip-report-template";
import { renderHtmlToPdf } from "./html-to-pdf";

export async function generateTripReportPdf(report: TripReport, total: number): Promise<void> {
  const html = buildTripReportHtml(report, total);
  const datePart = report.tripDate || report.reportDate || "";
  await renderHtmlToPdf(html, `出張報告書_${datePart}.pdf`);
}
