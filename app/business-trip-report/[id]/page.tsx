"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Eye, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { TripReportDocument } from "@/components/trip-report-document";
import type { HistoryRecord, TripExpenseRow, TripReport } from "@/lib/types";
import {
  deleteTripReport,
  getTripReport,
  mergeRemoteTripReports,
  saveTripReport,
} from "@/lib/trip-report-storage";
import { getGasUrl } from "@/lib/storage";
import {
  deleteTripReportRemote,
  fetchHistory,
  fetchTripReports,
  GasClientError,
  saveTripReportRemote,
} from "@/lib/gas-client";

/** GASへの同期はデバウンスして送る(入力のたびに毎回POSTしないようにするため)。 */
const REMOTE_SYNC_DELAY_MS = 1500;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSearchStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function yen(amount: number): string {
  return `¥${(Number(amount) || 0).toLocaleString("ja-JP")}`;
}

export default function TripReportEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [report, setReport] = useState<TripReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [searchStart, setSearchStart] = useState(defaultSearchStart);
  const [searchEnd, setSearchEnd] = useState(today);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<HistoryRecord[]>([]);
  const [searchChecked, setSearchChecked] = useState<Set<number>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const found = getTripReport(id);
    if (found) {
      setReport(found);
      setLoaded(true);
      return;
    }

    // ローカルになければ、スプレッドシート側に残っていないか確認する
    // (別ブラウザで開いた場合や、localStorageが消えてしまった場合の復元用)。
    const gasUrl = getGasUrl();
    if (!gasUrl) {
      setNotFound(true);
      return;
    }
    fetchTripReports(gasUrl)
      .then((remote) => {
        const match = remote.find((r) => r.id === id);
        if (!match) {
          setNotFound(true);
          return;
        }
        mergeRemoteTripReports(remote);
        setReport(match);
        setLoaded(true);
      })
      .catch(() => {
        setNotFound(true);
      });
  }, [id]);

  // 読み込みが終わるまでは、まだ空の初期状態を誤って保存しないようにする
  useEffect(() => {
    if (!loaded || !report) return;
    saveTripReport({ ...report, updatedAt: new Date().toISOString() });
  }, [report, loaded]);

  // スプレッドシートへの保存は、入力のたびに毎回POSTしないようデバウンスする。
  const remoteSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded || !report) return;
    const gasUrl = getGasUrl();
    if (!gasUrl) return;

    if (remoteSyncTimer.current) clearTimeout(remoteSyncTimer.current);
    remoteSyncTimer.current = setTimeout(() => {
      saveTripReportRemote(gasUrl, report).catch(() => {
        // スプレッドシートへの同期に失敗しても、ローカルの保存・編集は継続できるようにする
      });
    }, REMOTE_SYNC_DELAY_MS);

    return () => {
      if (remoteSyncTimer.current) clearTimeout(remoteSyncTimer.current);
    };
  }, [report, loaded]);

  const total = report ? report.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) : 0;

  function updateField<K extends keyof TripReport>(key: K, value: TripReport[K]) {
    setReport((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateExpense(expenseId: string, patch: Partial<TripExpenseRow>) {
    setReport((prev) =>
      prev
        ? {
            ...prev,
            expenses: prev.expenses.map((e) => (e.id === expenseId ? { ...e, ...patch } : e)),
          }
        : prev
    );
  }

  function addExpenseRow() {
    setReport((prev) =>
      prev
        ? {
            ...prev,
            expenses: [
              ...prev.expenses,
              { id: crypto.randomUUID(), date: today(), description: "", amount: 0, note: "" },
            ],
          }
        : prev
    );
  }

  function deleteExpenseRow(expenseId: string) {
    setReport((prev) =>
      prev ? { ...prev, expenses: prev.expenses.filter((e) => e.id !== expenseId) } : prev
    );
  }

  function handleDeleteReport() {
    if (!window.confirm("この出張報告書を削除しますか?")) return;
    if (remoteSyncTimer.current) clearTimeout(remoteSyncTimer.current);
    deleteTripReport(id);
    const gasUrl = getGasUrl();
    if (gasUrl) {
      deleteTripReportRemote(gasUrl, id).catch(() => {
        // スプレッドシート側の削除に失敗しても、ローカルの削除・画面遷移は継続する
      });
    }
    router.push("/business-trip-report");
  }

  /** 指定期間の保存済み明細を検索し、ポップアップで選択できるようにする。 */
  async function handleSearch() {
    setSearchError(null);
    const gasUrl = getGasUrl();
    if (!gasUrl) {
      setSearchError("GAS WebアプリURLが未設定です。「設定」画面で登録してください。");
      return;
    }
    setSearchLoading(true);
    try {
      const records = await fetchHistory(gasUrl);
      const filtered = records
        .filter((r) => r.date >= searchStart && r.date <= searchEnd)
        .sort((a, b) => a.date.localeCompare(b.date));
      setSearchResults(filtered);
      setSearchChecked(new Set());
      setSearchOpen(true);
    } catch (err) {
      setSearchError(err instanceof GasClientError ? err.message : "検索に失敗しました。");
    } finally {
      setSearchLoading(false);
    }
  }

  function toggleSearchChecked(index: number) {
    setSearchChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function handleAddSelectedFromSearch() {
    const selected = searchResults.filter((_, i) => searchChecked.has(i));
    if (selected.length === 0) return;
    setReport((prev) =>
      prev
        ? {
            ...prev,
            expenses: [
              ...prev.expenses,
              ...selected.map((r) => ({
                id: crypto.randomUUID(),
                date: r.date,
                description: r.description,
                amount: Number(r.amount) || 0,
                note: r.memo || "",
              })),
            ],
          }
        : prev
    );
    setSearchOpen(false);
    setSearchResults([]);
    setSearchChecked(new Set());
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Link
          href="/business-trip-report"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          出張報告書一覧に戻る
        </Link>
        <Alert variant="destructive">この出張報告書は見つかりませんでした。</Alert>
      </div>
    );
  }

  if (!report) {
    return <p className="py-8 text-center text-sm text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <Link
          href="/business-trip-report"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          出張報告書一覧に戻る
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">出張報告書</h1>
            <p className="text-sm text-muted-foreground">
              経費精算PDF作成画面でチェックした明細を転記するか、出張経費欄で期間を指定して
              保存済みの明細を検索・追加できます。内容は自動的に保存され、GAS
              WebアプリURLを設定していればスプレッドシートにも保存されます。
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDeleteReport} className="self-start sm:self-auto">
            <Trash2 className="mr-2 h-4 w-4" />
            削除
          </Button>
        </div>
      </header>

      {previewOpen ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              <Pencil className="mr-2 h-4 w-4" />
              編集に戻る
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              印刷してPDFに保存
            </Button>
          </div>
          <p className="text-xs text-muted-foreground print:hidden">
            「印刷してPDFに保存」を押すとブラウザの印刷画面が開きます。印刷先(送信先)で
            「PDFに保存」を選ぶとPDFファイルとして保存できます。
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-slate-100 p-4 print:border-0 print:bg-white print:p-0 sm:p-8">
            <TripReportDocument report={report} total={total} />
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>基本情報</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-date">日時(発行日)</Label>
                <Input
                  id="report-date"
                  type="date"
                  value={report.reportDate}
                  onChange={(e) => updateField("reportDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="applicant-name">氏名</Label>
                <Input
                  id="applicant-name"
                  value={report.applicantName}
                  onChange={(e) => updateField("applicantName", e.target.value)}
                  placeholder="山田 太郎"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trip-date">日時(出張日)</Label>
                <Input
                  id="trip-date"
                  type="date"
                  value={report.tripDate}
                  onChange={(e) => updateField("tripDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">場所</Label>
                <Input
                  id="location"
                  value={report.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="西京極総合運動公園"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="purpose">目的</Label>
                <Input
                  id="purpose"
                  value={report.purpose}
                  onChange={(e) => updateField("purpose", e.target.value)}
                  placeholder="京都外大西桑原君スカウト"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="content">報告内容</Label>
                <Textarea
                  id="content"
                  className="min-h-40"
                  value={report.content}
                  onChange={(e) => updateField("content", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>メモ</CardTitle>
              <CardDescription>社内確認用の任意メモです。PDF・印刷には出力されません。</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="memo"
                className="min-h-20"
                value={report.memo}
                onChange={(e) => updateField("memo", e.target.value)}
                placeholder="経理確認用のメモなど"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div>
                <CardTitle>出張経費</CardTitle>
                <CardDescription>
                  {report.expenses.length}件 立替金額合計{yen(total)}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addExpenseRow}>
                <Plus className="mr-2 h-4 w-4" />
                行を追加
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="search-start" className="text-xs">
                    開始日
                  </Label>
                  <Input
                    id="search-start"
                    type="date"
                    className="h-9 w-40"
                    value={searchStart}
                    onChange={(e) => setSearchStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="search-end" className="text-xs">
                    終了日
                  </Label>
                  <Input
                    id="search-end"
                    type="date"
                    className="h-9 w-40"
                    value={searchEnd}
                    onChange={(e) => setSearchEnd(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSearch()}
                  disabled={searchLoading}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {searchLoading ? "検索中..." : "過去の明細を検索"}
                </Button>
              </div>
              {searchError && (
                <Alert variant="destructive" className="mb-4">
                  {searchError}
                </Alert>
              )}
              {report.expenses.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  経費がありません。「行を追加」で手入力するか、経費精算PDF作成画面で明細をチェックして転記してください。
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">日付</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead className="w-32 text-right">金額</TableHead>
                      <TableHead className="w-40">備考</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Input
                            type="date"
                            value={e.date}
                            onChange={(ev) => updateExpense(e.id, { date: ev.target.value })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={e.description}
                            onChange={(ev) =>
                              updateExpense(e.id, { description: ev.target.value })
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={e.amount}
                            onChange={(ev) =>
                              updateExpense(e.id, { amount: Number(ev.target.value) || 0 })
                            }
                            className="h-9 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={e.note}
                            onChange={(ev) => updateExpense(e.id, { note: ev.target.value })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteExpenseRow(e.id)}
                            aria-label="この行を削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              プレビューしてPDFに出力
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="過去の明細から追加"
        description={`${searchStart} 〜 ${searchEnd} の明細です。追加する項目にチェックしてください。`}
        className="max-w-4xl"
      >
        {searchResults.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            この期間の明細はありません。
          </p>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-24">利用日</TableHead>
                    <TableHead className="w-48">請求先組織</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead>メモ</TableHead>
                    <TableHead className="w-28 text-right">金額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={searchChecked.has(i)}
                          onChange={() => toggleSearchChecked(i)}
                          aria-label="この明細を選択"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.organization}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-muted-foreground">{r.memo}</TableCell>
                      <TableCell className="text-right font-medium">{yen(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setSearchOpen(false)}>
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleAddSelectedFromSearch}
                disabled={searchChecked.size === 0}
              >
                選択した{searchChecked.size}件を追加
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
