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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { TripExpenseRow, TripReport } from "@/lib/types";
import {
  loadTripReportDraft,
  popTripReportTransfer,
  saveTripReportDraft,
} from "@/lib/trip-report-storage";
import { generateTripReportPdf } from "@/lib/trip-report-pdf";

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

export default function BusinessTripReportPage() {
  const [report, setReport] = useState<TripReport>(emptyReport);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

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
          経費精算PDF作成画面でチェックした明細を、下の出張経費欄に転記できます。
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
    </div>
  );
}
