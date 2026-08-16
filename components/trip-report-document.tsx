import type { TripReport } from "@/lib/types";

function yen(amount: number): string {
  return `¥${(Number(amount) || 0).toLocaleString("ja-JP")}`;
}

function formatDateJpLong(iso: string): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts.map(Number);
  return `${y}年${m}月${d}日`;
}

const infoRows: Array<{ label: string; key: "tripDate" | "location" | "purpose" | "content" }> = [
  { label: "日時", key: "tripDate" },
  { label: "場所", key: "location" },
  { label: "目的", key: "purpose" },
  { label: "報告内容", key: "content" },
];

/**
 * 出張報告書の印刷・PDF保存対象となる、実際の見た目そのままの文書。
 * ブラウザの印刷機能(印刷 → PDFとして保存)で出力することを前提としている。
 */
export function TripReportDocument({ report, total }: { report: TripReport; total: number }) {
  return (
    <div
      className="mx-auto w-full max-w-[210mm] bg-white p-10 text-slate-900 sm:p-14"
      style={{ fontFamily: "'Hiragino Sans','Yu Gothic','Noto Sans JP',sans-serif" }}
    >
      <div className="mb-10 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-1.5 rounded-full bg-slate-800" />
          <h1 className="text-3xl font-bold tracking-wide">出張報告書</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex gap-8">
            <div>
              <div className="text-xs font-medium text-slate-500">日時</div>
              <div className="mt-0.5 text-sm font-semibold">{formatDateJpLong(report.reportDate)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">氏名</div>
              <div className="mt-0.5 text-sm font-semibold">{report.applicantName || "-"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10 overflow-hidden rounded-xl border border-slate-200">
        {infoRows.map((row, i) => (
          <div
            key={row.key}
            className={`flex ${i > 0 ? "border-t border-slate-200" : ""}`}
          >
            <div className="w-28 shrink-0 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 sm:w-32">
              {row.label}
            </div>
            <div className="flex-1 whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-slate-800">
              {report[row.key] || "-"}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="bg-slate-800 px-4 py-2.5 text-center text-sm font-semibold tracking-wide text-white">
          出張経費
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="w-28 px-3 py-2 text-left font-medium">日付</th>
              <th className="px-3 py-2 text-left font-medium">内容</th>
              <th className="w-28 px-3 py-2 text-right font-medium">金額</th>
              <th className="w-32 px-3 py-2 text-left font-medium">備考</th>
            </tr>
          </thead>
          <tbody>
            {report.expenses.length === 0 ? (
              <tr>
                <td colSpan={4} className="border-t border-slate-200 px-3 py-8 text-center text-slate-400">
                  経費はありません
                </td>
              </tr>
            ) : (
              report.expenses.map((e, i) => (
                <tr key={e.id} className={i % 2 === 1 ? "bg-slate-50" : undefined}>
                  <td className="whitespace-nowrap border-t border-slate-200 px-3 py-2.5">
                    {formatDateJpLong(e.date)}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2.5">{e.description}</td>
                  <td className="border-t border-slate-200 px-3 py-2.5 text-right tabular-nums">
                    {yen(e.amount)}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2.5 text-slate-600">{e.note}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-semibold">
              <td colSpan={2} className="border-t border-slate-300 px-3 py-3 text-center">
                立替金額合計
              </td>
              <td className="border-t border-slate-300 px-3 py-3 text-right tabular-nums">{yen(total)}</td>
              <td className="border-t border-slate-300 px-3 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
