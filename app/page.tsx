"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CsvUploader } from "@/components/csv-uploader";
import { CashEntryForm } from "@/components/cash-entry-form";
import { TransactionTable } from "@/components/transaction-table";
import { PeriodSelector } from "@/components/period-selector";
import { SummaryPanel } from "@/components/summary-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { History, Settings } from "lucide-react";
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

const defaultIssueDate = today.toISOString().slice(0, 10);

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closingDay, setClosingDay] = useState(15);
  const [targetYearMonth, setTargetYearMonth] = useState(defaultYearMonth);
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
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

  function handleChangeMemo(id: string, memo: string) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, memo } : t)));
  }

  function handleAddCashTransaction(transaction: Transaction) {
    setTransactions((prev) => [...prev, transaction]);
    setStatus({ type: "success", message: "現金決済を1件追加しました。" });
  }

  function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  /**
   * 確定操作: スプレッドシートへの確定保存とPDF出力を1つの操作として行う。
   * 「完成版」として扱うため、保存に失敗した場合はPDFは出力しない。
   */
  async function handleFinalizeAndGeneratePdf() {
    setStatus(null);
    setBusy("pdf");
    try {
      const gasUrl = getGasUrl();
      const payload = buildSavePayload(
        periodTransactions,
        { start: periodStart, end: periodEnd },
        { issueDate, status: "final" }
      );
      const res = await saveTransactions(gasUrl, payload);
      await generateExpensePdf(aggregation, { issueDate, note });
      setStatus({
        type: "success",
        message: `確定として${res.saved ?? payload.transactions.length}件をスプレッドシートに保存し、PDFを出力しました。`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof GasClientError
            ? err.message
            : `確定に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(null);
    }
  }

  /** 下書き保存: PDFは作らず、確定前のデータをスプレッドシートに一時保存する。 */
  async function handleSaveDraft() {
    setStatus(null);
    setBusy("save");
    try {
      const gasUrl = getGasUrl();
      const payload = buildSavePayload(
        periodTransactions,
        { start: periodStart, end: periodEnd },
        { issueDate, status: "draft" }
      );
      const res = await saveTransactions(gasUrl, payload);
      setStatus({
        type: "success",
        message: `スプレッドシートに${res.saved ?? payload.transactions.length}件を一時保存しました。`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof GasClientError
            ? err.message
            : `一時保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
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
        <div className="flex gap-2">
          <Link href="/history">
            <Button variant="outline" size="sm">
              <History className="mr-2 h-4 w-4" />
              履歴
            </Button>
          </Link>
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
          GAS WebアプリURLが未設定です。一時保存・確定(PDF出力)を行うには、
          <Link href="/settings" className="underline font-medium">
            設定画面
          </Link>
          であなた自身のURLを登録してください。
        </Alert>
      )}

      {status && (
        <Alert variant={status.type === "success" ? "success" : "destructive"}>
          {status.message}
        </Alert>
      )}

      <CsvUploader onImport={handleImport} />

      <CashEntryForm onAdd={handleAddCashTransaction} />

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
            onChangeMemo={handleChangeMemo}
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
              <Label htmlFor="issue-date">発行日</Label>
              <Input
                id="issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
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
          <p className="text-xs text-muted-foreground">
            「経費精算PDFを出力」は確定版としてスプレッドシートに保存したうえでPDFを作成します。
            まだ確定しない下書き段階では「スプレッドシートに一時保存」をご利用ください。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleFinalizeAndGeneratePdf} disabled={busy !== null || !gasUrlConfigured}>
              {busy === "pdf" ? "確定・PDF作成中..." : "経費精算PDFを出力"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={busy !== null || !gasUrlConfigured}
            >
              {busy === "save" ? "保存中..." : "スプレッドシートに一時保存"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
