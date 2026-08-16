"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CsvUploader } from "@/components/csv-uploader";
import { TransactionTable } from "@/components/transaction-table";
import { PeriodSelector } from "@/components/period-selector";
import { SummaryPanel } from "@/components/summary-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Settings } from "lucide-react";
import type { OrganizationId, Transaction } from "@/lib/types";
import { computePeriod, aggregateByOrganization, filterByPeriod } from "@/lib/aggregate";
import {
  getGasUrl,
  loadDraftTransactions,
  saveDraftTransactions,
} from "@/lib/storage";
import { generateExpensePdf } from "@/lib/pdf-generator";
import { buildSavePayload, saveTransactions, GasClientError } from "@/lib/gas-client";

const today = new Date();
const defaultYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closingDay, setClosingDay] = useState(15);
  const [targetYearMonth, setTargetYearMonth] = useState(defaultYearMonth);
  const [applicantName, setApplicantName] = useState("");
  const [note, setNote] = useState("");
  const [gasUrlConfigured, setGasUrlConfigured] = useState(true);
  const [busy, setBusy] = useState<"pdf" | "save" | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    setTransactions(loadDraftTransactions());
    setGasUrlConfigured(Boolean(getGasUrl()));
  }, []);

  useEffect(() => {
    saveDraftTransactions(transactions);
  }, [transactions]);

  const { periodStart, periodEnd } = useMemo(
    () => computePeriod(closingDay, targetYearMonth),
    [closingDay, targetYearMonth]
  );

  const periodTransactions = useMemo(
    () => filterByPeriod(transactions, periodStart, periodEnd),
    [transactions, periodStart, periodEnd]
  );

  const unclassifiedInPeriod = periodTransactions.filter((t) => !t.organization).length;

  const aggregation = useMemo(
    () => aggregateByOrganization(transactions, periodStart, periodEnd),
    [transactions, periodStart, periodEnd]
  );

  function handleImport(imported: Transaction[], skippedRows: number) {
    setTransactions((prev) => [...prev, ...imported]);
    setStatus({
      type: "success",
      message: `${imported.length}件を取り込みました。${
        skippedRows > 0 ? `(${skippedRows}件は形式を認識できず読み飛ばしました)` : ""
      }`,
    });
  }

  function handleChangeOrganization(id: string, organization: OrganizationId) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, organization } : t))
    );
  }

  function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleGeneratePdf() {
    setStatus(null);
    setBusy("pdf");
    try {
      await generateExpensePdf(aggregation, { applicantName, note });
      setStatus({ type: "success", message: "PDFを出力しました。" });
    } catch (err) {
      setStatus({
        type: "error",
        message: `PDFの出力に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveToSheet() {
    setStatus(null);
    setBusy("save");
    try {
      const gasUrl = getGasUrl();
      const payload = buildSavePayload(periodTransactions, {
        start: periodStart,
        end: periodEnd,
      });
      const res = await saveTransactions(gasUrl, payload);
      setStatus({
        type: "success",
        message: `スプレッドシートに${res.saved ?? payload.transactions.length}件保存しました。`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof GasClientError
            ? err.message
            : `保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">経費精算PDF作成</h1>
          <p className="text-sm text-muted-foreground">
            クレジットカード明細を仕分けして、組織ごとの経費精算PDFを作成します。
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            設定
          </Button>
        </Link>
      </header>

      {!gasUrlConfigured && (
        <Alert variant="destructive">
          GAS WebアプリURLが未設定です。スプレッドシートへの保存機能を使うには、
          <Link href="/settings" className="underline font-medium">
            設定画面
          </Link>
          であなた自身のURLを登録してください。(PDF出力のみなら設定不要です)
        </Alert>
      )}

      {status && (
        <Alert variant={status.type === "success" ? "success" : "destructive"}>
          {status.message}
        </Alert>
      )}

      <CsvUploader onImport={handleImport} />

      <PeriodSelector
        closingDay={closingDay}
        onChangeClosingDay={setClosingDay}
        targetYearMonth={targetYearMonth}
        onChangeTargetYearMonth={setTargetYearMonth}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />

      <Card>
        <CardHeader>
          <CardTitle>明細の仕分け</CardTitle>
          <CardDescription>
            各明細の請求先組織を選択してください。プライベートの決済は「除外」を選びます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionTable
            transactions={transactions}
            onChangeOrganization={handleChangeOrganization}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <SummaryPanel result={aggregation} />

      <Card>
        <CardHeader>
          <CardTitle>4. PDF出力・保存</CardTitle>
          <CardDescription>
            集計期間内に未仕分けの明細が残っていると集計から漏れます。事前に確認してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unclassifiedInPeriod > 0 && (
            <Alert variant="destructive">
              対象期間内に未仕分けの明細が{unclassifiedInPeriod}件あります。
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="applicant-name">申請者名</Label>
              <Input
                id="applicant-name"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="山田 太郎"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">備考(任意)</Label>
              <Textarea
                id="note"
                className="min-h-10"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGeneratePdf} disabled={busy !== null}>
              {busy === "pdf" ? "PDF作成中..." : "経費精算PDFを出力"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveToSheet}
              disabled={busy !== null || !gasUrlConfigured}
            >
              {busy === "save" ? "保存中..." : "スプレッドシートに保存"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
