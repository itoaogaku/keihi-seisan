"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, RefreshCw, Settings } from "lucide-react";
import type { HistoryRecord } from "@/lib/types";
import { getGasUrl } from "@/lib/storage";
import { fetchHistory, GasClientError } from "@/lib/gas-client";
import { exportHistoryToCsv } from "@/lib/csv-export";

const ALL_ISSUE_DATES = "all";

function yen(amount: number): string {
  return `¥${(Number(amount) || 0).toLocaleString("ja-JP")}`;
}

export default function HistoryPage() {
  const [gasUrlConfigured, setGasUrlConfigured] = useState(true);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueDateFilter, setIssueDateFilter] = useState(ALL_ISSUE_DATES);

  const load = useCallback(async () => {
    const gasUrl = getGasUrl();
    if (!gasUrl) {
      setGasUrlConfigured(false);
      return;
    }
    setGasUrlConfigured(true);
    setError(null);
    setLoading(true);
    try {
      const fetched = await fetchHistory(gasUrl);
      const sorted = [...fetched].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      setRecords(sorted);
    } catch (err) {
      setError(err instanceof GasClientError ? err.message : "保存履歴の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issueDates = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.issueDate).filter(Boolean))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [records]
  );

  const filteredRecords = useMemo(
    () =>
      issueDateFilter === ALL_ISSUE_DATES
        ? records
        : records.filter((r) => r.issueDate === issueDateFilter),
    [records, issueDateFilter]
  );

  const grandTotal = filteredRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  function handleExport() {
    exportHistoryToCsv(
      filteredRecords,
      `経費精算_保存履歴_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">保存履歴</h1>
            <p className="text-sm text-muted-foreground">
              スプレッドシートに保存済みの明細をすべて表示します(期間による絞り込みはありません)。
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              設定
            </Button>
          </Link>
        </div>
      </header>

      {!gasUrlConfigured && (
        <Alert variant="destructive">
          GAS WebアプリURLが未設定です。
          <Link href="/settings" className="underline font-medium">
            設定画面
          </Link>
          であなた自身のURLを登録すると、保存済みの履歴を表示できます。
        </Alert>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>一覧</CardTitle>
            <CardDescription>
              {filteredRecords.length > 0 ? (
                <>
                  全{filteredRecords.length}件 合計{yen(grandTotal)}
                </>
              ) : (
                "保存済みの明細"
              )}
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
            {issueDates.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="issue-date-filter" className="text-xs">
                  発行日で絞り込み
                </Label>
                <Select
                  id="issue-date-filter"
                  className="h-9 w-40"
                  value={issueDateFilter}
                  onChange={(e) => setIssueDateFilter(e.target.value)}
                >
                  <option value={ALL_ISSUE_DATES}>すべて</option>
                  {issueDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              更新
            </Button>
            <Button size="sm" onClick={handleExport} disabled={filteredRecords.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSVで書き出す
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">読み込み中...</p>
          ) : records.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {gasUrlConfigured
                ? "保存されているデータはまだありません。"
                : "GAS WebアプリURLを設定すると、ここに保存済みの明細が表示されます。"}
            </p>
          ) : filteredRecords.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              選択した発行日のデータはありません。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">保存日時</TableHead>
                  <TableHead className="w-20">区分</TableHead>
                  <TableHead className="w-24">発行日</TableHead>
                  <TableHead className="w-24">利用日</TableHead>
                  <TableHead className="w-16">方法</TableHead>
                  <TableHead className="w-56">請求先組織</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="w-28 text-right">金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r, i) => (
                  <TableRow key={`${r.savedAt}-${r.date}-${i}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.savedAt}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "確定" ? "success" : "outline"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.issueDate}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.date}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.paymentMethod === "現金" ? "outline" : "secondary"}>
                        {r.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.organization}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-muted-foreground">{r.memo}</TableCell>
                    <TableCell className="text-right font-medium">{yen(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
