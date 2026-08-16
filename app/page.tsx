"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CsvUploader } from "@/components/csv-uploader";
import { CashEntryForm } from "@/components/cash-entry-form";
import { TransactionTable } from "@/components/transaction-table";
import { SummaryPanel } from "@/components/summary-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { History, Plane, Settings } from "lucide-react";
import type { OrganizationId, Transaction } from "@/lib/types";
import { aggregateByOrganization } from "@/lib/aggregate";
import {
  getGasUrl,
  loadDraftTransactions,
  saveDraftTransactions,
} from "@/lib/storage";
import { generateExpensePdf } from "@/lib/pdf-generator";
import { buildSavePayload, saveTransactions, fetchHistory, GasClientError } from "@/lib/gas-client";
import { pushTripReportTransfer } from "@/lib/trip-report-storage";

const defaultIssueDate = new Date().toISOString().slice(0, 10);

export default function HomePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [note, setNote] = useState("");
  const [gasUrlConfigured, setGasUrlConfigured] = useState(true);
  const [busy, setBusy] = useState<"pdf" | "save" | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [historyMemoMap, setHistoryMemoMap] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTransactions(loadDraftTransactions());
    const gasUrl = getGasUrl();
    setGasUrlConfigured(Boolean(gasUrl));
    if (!gasUrl) return;

    fetchHistory(gasUrl)
      .then((records) => {
        const sorted = [...records].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        const map: Record<string, string> = {};
        for (const r of sorted) {
          if (r.memo && !map[r.description]) {
            map[r.description] = r.memo;
          }
        }
        setHistoryMemoMap(map);
      })
      .catch(() => {
        // 履歴が取得できなくてもメモの自動反映を諦めるだけで、アプリ全体には影響させない
      });
  }, []);

  useEffect(() => {
    saveDraftTransactions(transactions);
  }, [transactions]);

  const unclassifiedCount = transactions.filter((t) => !t.organization).length;

  const aggregation = useMemo(() => aggregateByOrganization(transactions), [transactions]);

  /** 過去に同じ内容(内容欄が完全一致)の明細があれば、そのメモを引き継ぐ。 */
  function withHistoricalMemo(t: Transaction): Transaction {
    if (t.memo) return t;
    const historical = historyMemoMap[t.description];
    return historical ? { ...t, memo: historical } : t;
  }

  function handleImport(imported: Transaction[], skippedRows: number) {
    setTransactions((prev) => [...prev, ...imported.map(withHistoricalMemo)]);
    setStatus({
      type: "success",
      message: `${imported.length}件を取り込みました。${
        skippedRows > 0 ? `(${skippedRows}件は形式を認識できず読み飛ばしました)` : ""
      }`,
    });
  }

  function handleChangeOrganization(id: string, organization: OrganizationId) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? organization === "exclude"
            ? { ...t, organization }
            : withHistoricalMemo({ ...t, organization })
          : t
      )
    );
  }

  function handleChangeMemo(id: string, memo: string) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, memo } : t)));
  }

  function handleAddCashTransaction(transaction: Transaction) {
    setTransactions((prev) => [...prev, withHistoricalMemo(transaction)]);
    setStatus({ type: "success", message: "現金決済を1件追加しました。" });
  }

  function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleToggleSelectAll(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  /** 選択した明細を出張報告書タブへ経費として転記する。除外扱いの明細は転記しない。 */
  function handleTranscribeToTripReport() {
    const selected = transactions.filter(
      (t) => selectedIds.has(t.id) && t.organization !== "exclude"
    );

    if (selected.length === 0) {
      setStatus({
        type: "error",
        message: "転記できる明細が選択されていません(「除外」の明細は転記できません)。",
      });
      return;
    }

    pushTripReportTransfer(
      selected.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        note: t.memo,
      }))
    );
    router.push("/business-trip-report");
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
      const payload = buildSavePayload(transactions, { issueDate, status: "final" });
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
      const payload = buildSavePayload(transactions, { issueDate, status: "draft" });
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
          <Link href="/business-trip-report">
            <Button variant="outline" size="sm">
              <Plane className="mr-2 h-4 w-4" />
              出張報告書
            </Button>
          </Link>
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

      <Card>
        <CardHeader>
          <CardTitle>明細の仕分け</CardTitle>
          <CardDescription>
            各明細の請求先組織を選択してください。プライベートの決済は「除外」を選びます。
            チェックした明細は「出張報告書へ転記」で出張報告書タブの経費欄に追加できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TransactionTable
            transactions={transactions}
            onChangeOrganization={handleChangeOrganization}
            onChangeMemo={handleChangeMemo}
            onDelete={handleDelete}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" onClick={handleTranscribeToTripReport}>
                <Plane className="mr-2 h-4 w-4" />
                選択した{selectedIds.size}件を出張報告書へ転記
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SummaryPanel result={aggregation} />

      <Card>
        <CardHeader>
          <CardTitle>3. PDF出力・保存</CardTitle>
          <CardDescription>
            未仕分けの明細が残っていると集計から漏れます。事前に確認してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unclassifiedCount > 0 && (
            <Alert variant="destructive">未仕分けの明細が{unclassifiedCount}件あります。</Alert>
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
