"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { HistoryRecord, TripExpenseRow, TripReport } from "@/lib/types";
import {
  loadTripReportDraft,
  popTripReportTransfer,
  saveTripReportDraft,
} from "@/lib/trip-report-storage";
import { generateTripReportPdf } from "@/lib/trip-report-pdf";
import { getGasUrl } from "@/lib/storage";
import { fetchHistory, GasClientError } from "@/lib/gas-client";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyReport(): TripReport {
  return {
    reportDate: today(),
    applicantName: "",
    tripDate: today(),
    location: "",
    purpose: "",
    content: "",
    expenses: [],
  };
}

function yen(amount: number): string {
  return `¥${(Number(amount) || 0).toLocaleString("ja-JP")}`;
}

function defaultSearchStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function BusinessTripReportPage() {
  const [report, setReport] = useState<TripReport>(emptyReport);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [searchStart, setSearchStart] = useState(defaultSearchStart);
  const [searchEnd, setSearchEnd] = useState(today);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<HistoryRecord[]>([]);
  const [searchChecked, setSearchChecked] = useState<Set<number>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // popTripReportTransfer()はlocalStorageを消費する副作用のため、
  // React 18 の開発モードによるeffect二重実行で2回走ると転記内容が失われる。
  // refで初回のみに限定して防ぐ。
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const draft = loadTripReportDraft();
    const base = draft ?? emptyReport();

    const transferred = popTripReportTransfer();
    if (transferred.length > 0) {
      setReport({ ...base, expenses: [...base.expenses, ...transferred] });
      setStatus({
        type: "success",
        message: `経費精算PDF作成から${transferred.length}件を出張経費に追加しました。`,
      });
    } else {
      setReport(base);
    }
  }, []);

  useEffect(() => {
    saveTripReportDraft(report);
  }, [report]);

  const total = report.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  function updateField<K extends keyof TripReport>(key: K, value: TripReport[K]) {
    setReport((prev) => ({ ...prev, [key]: value }));
  }

  function updateExpense(id: string, patch: Partial<TripExpenseRow>) {
    setReport((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function addExpenseRow() {
    setReport((prev) => ({
      ...prev,
      expenses: [
        ...prev.expenses,
        { id: crypto.randomUUID(), date: today(), description: "", amount: 0, note: "" },
      ],
    }));
  }

  function deleteExpenseRow(id: string) {
    setReport((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) }));
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
    setReport((prev) => ({
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
    }));
    setSearchOpen(false);
    setSearchResults([]);
    setSearchChecked(new Set());
  }

  async function handleGeneratePdf() {
    setStatus(null);
    setBusy(true);
    try {
      await generateTripReportPdf(report, total);
      setStatus({ type: "success", message: "出張報告書のPDFを出力しました。" });
    } catch (err) {
      setStatus({
        type: "error",
        message: `PDFの出力に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(false);
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
          戻る
        </Link>
        <h1 className="text-2xl font-bold">出張報告書</h1>
        <p className="text-sm text-muted-foreground">
          経費精算PDF作成画面でチェックした明細を転記するか、出張経費欄で期間を指定して
          保存済みの明細を検索・追加できます。
        </p>
      </header>

      {status && (
        <Alert variant={status.type === "success" ? "success" : "destructive"}>
          {status.message}
        </Alert>
      )}

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
        <CardHeader className="flex-row items-center justify-between space-y-0">
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
            <Button variant="outline" size="sm" onClick={() => void handleSearch()} disabled={searchLoading}>
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
                        onChange={(ev) => updateExpense(e.id, { description: ev.target.value })}
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
        <Button onClick={handleGeneratePdf} disabled={busy}>
          {busy ? "PDF作成中..." : "出張報告書のPDFを出力"}
        </Button>
      </div>

      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="過去の明細から追加"
        description={`${searchStart} 〜 ${searchEnd} の明細です。追加する項目にチェックしてください。`}
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
                      <TableCell>{r.organization}</TableCell>
                      <TableCell>{r.description}</TableCell>
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
              <Button size="sm" onClick={handleAddSelectedFromSearch} disabled={searchChecked.size === 0}>
                選択した{searchChecked.size}件を追加
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
