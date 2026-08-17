"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { TripReport } from "@/lib/types";
import {
  deleteTripReport,
  listTripReports,
  mergeRemoteTripReports,
} from "@/lib/trip-report-storage";
import { getGasUrl } from "@/lib/storage";
import { deleteTripReportRemote, fetchTripReports } from "@/lib/gas-client";

function yen(amount: number): string {
  return `¥${(Number(amount) || 0).toLocaleString("ja-JP")}`;
}

function totalOf(report: TripReport): number {
  return report.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export default function TripReportListPage() {
  const [reports, setReports] = useState<TripReport[]>([]);

  useEffect(() => {
    setReports(listTripReports());

    // ローカルにない、またはスプレッドシート側の方が新しい報告書を取り込む
    // (別ブラウザで作成した場合や、localStorageが消えた場合の復元用)。
    const gasUrl = getGasUrl();
    if (!gasUrl) return;
    fetchTripReports(gasUrl)
      .then((remote) => {
        mergeRemoteTripReports(remote);
        setReports(listTripReports());
      })
      .catch(() => {
        // 取得できなくても、ローカルの一覧表示自体には影響させない
      });
  }, []);

  function handleDelete(id: string) {
    if (!window.confirm("この出張報告書を削除しますか?")) return;
    deleteTripReport(id);
    setReports(listTripReports());
    const gasUrl = getGasUrl();
    if (gasUrl) {
      deleteTripReportRemote(gasUrl, id).catch(() => {
        // スプレッドシート側の削除に失敗しても、ローカルの削除は継続する
      });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          経費精算に戻る
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">出張報告書</h1>
            <p className="text-sm text-muted-foreground">
              作成した出張報告書の一覧です。このブラウザに保存され、GAS WebアプリURLを
              設定していればスプレッドシートにも保存されます。
            </p>
          </div>
          <Link href="/business-trip-report/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>一覧</CardTitle>
          <CardDescription>
            {reports.length > 0 ? `全${reports.length}件` : "作成済みの出張報告書"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              まだ出張報告書がありません。「新規作成」から作成してください。
            </p>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-3 rounded-md border border-border px-4 py-3 hover:bg-muted/50"
                >
                  <Link href={`/business-trip-report/${report.id}`} className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-medium">
                        {report.applicantName || "氏名未入力"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        発行日: {report.reportDate || "-"}
                      </span>
                      {report.location && (
                        <span className="text-xs text-muted-foreground">{report.location}</span>
                      )}
                      {report.purpose && (
                        <span className="truncate text-xs text-muted-foreground">
                          {report.purpose}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      経費{report.expenses.length}件 立替金額合計{yen(totalOf(report))}
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(report.id)}
                    aria-label="この出張報告書を削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
