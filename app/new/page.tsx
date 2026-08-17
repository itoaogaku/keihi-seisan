"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CsvUploader } from "@/components/csv-uploader";
import { ManualEntryForm } from "@/components/manual-entry-form";
import { TransactionTable } from "@/components/transaction-table";
import { SummaryPanel } from "@/components/summary-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { ArrowLeft, Eye, Pencil, Plane } from "lucide-react";
import type { OrganizationId, Transaction } from "@/lib/types";
import { NON_BILLABLE_ORGANIZATION_IDS, organizationIdByLabel } from "@/lib/types";
import { aggregateByOrganization } from "@/lib/aggregate";
import { buildSummaryHtml } from "@/lib/pdf-template";
import {
  clearDraftTransactions,
  getGasUrl,
  loadDraftTransactions,
  popEditBuffer,
  saveDraftTransactions,
} from "@/lib/storage";
import { generateExpensePdf } from "@/lib/pdf-generator";
import { buildSavePayload, saveTransactions, fetchHistory, GasClientError } from "@/lib/gas-client";
import { pushTripReportTransfer } from "@/lib/trip-report-storage";

const defaultIssueDate = new Date().toISOString().slice(0, 10);

/** 利用日+内容を、精算済み明細との重複チェック用のキーにする。 */
function duplicateKey(date: string, description: string): string {
  return `${date}|${description.trim()}`;
}

export default function NewEntryPage() {
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
  const [historyOrgMap, setHistoryOrgMap] = useState<Record<string, OrganizationId>>({});
  const [settledKeys, setSettledKeys] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingSavedAt, setEditingSavedAt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // popEditBuffer()はlocalStorageを消費する副作用のため、React 18の開発モードによる
  // effect二重実行で2回走ると編集データが失われる。refで初回のみに限定して防ぐ。
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const editBuffer = popEditBuffer();
    if (editBuffer) {
      setTransactions(editBuffer.transactions);
      setIssueDate(editBuffer.issueDate || defaultIssueDate);
      setEditingSavedAt(editBuffer.savedAt);
    } else {
      setTransactions(loadDraftTransactions());
    }

    const gasUrl = getGasUrl();
    setGasUrlConfigured(Boolean(gasUrl));
    if (!gasUrl) return;

    fetchHistory(gasUrl)
      .then((records) => {
        const sorted = [...records].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        const map: Record<string, string> = {};
        const orgMap: Record<string, OrganizationId> = {};
        for (const r of sorted) {
          if (r.memo && !map[r.description]) {
            map[r.description] = r.memo;
          }
          if (!orgMap[r.description]) {
            const orgId = organizationIdByLabel(r.organization);
            if (orgId) {
              orgMap[r.description] = orgId;
            }
          }
        }
        setHistoryMemoMap(map);
        setHistoryOrgMap(orgMap);

        // 発行済み(確定済み)の明細と同じ日付・内容のものを、取り込み時の重複候補として警告表示する。
        // 編集中のエントリ自身(replaceSavedAt対象)は重複扱いにしない。
        const settled = new Set<string>();
        for (const r of records) {
          if (r.status === "発行済み" && r.savedAt !== editBuffer?.savedAt) {
            settled.add(duplicateKey(r.date, r.description));
          }
        }
        setSettledKeys(settled);
      })
      .catch(() => {
        // 履歴が取得できなくてもメモの自動反映を諦めるだけで、アプリ全体には影響させない
      });
  }, []);

  useEffect(() => {
    saveDraftTransactions(transactions);
  }, [transactions]);

  const unclassifiedCount = transactions.filter((t) => !t.organization).length;

  /** 現在の明細に含まれる、取り込み済みCSVファイル名の一覧(重複なし)。 */
  const importedFileNames = useMemo(
    () =>
      Array.from(
        new Set(transactions.map((t) => t.sourceFile).filter((f): f is string => Boolean(f)))
      ),
    [transactions]
  );

  const aggregation = useMemo(() => aggregateByOrganization(transactions), [transactions]);

  /** 実際にPDFへ出力されるものと同じHTMLを、確定前のプレビュー表示にも使う。 */
  const previewHtml = useMemo(
    () => buildSummaryHtml(aggregation, { issueDate, note }),
    [aggregation, issueDate, note]
  );

  /**
   * 過去に同じ内容(内容欄が完全一致)の明細があれば、仕分け(請求先組織)とメモを引き継ぐ。
   * 組織は未仕分けのときのみ補完し、既にユーザーが選んだ組織は上書きしない。
   */
  function withHistoricalDefaults(t: Transaction): Transaction {
    let next = t;
    if (!next.organization) {
      const historicalOrg = historyOrgMap[next.description];
      if (historicalOrg) {
        next = { ...next, organization: historicalOrg };
      }
    }
    if (!next.memo) {
      const historicalMemo = historyMemoMap[next.description];
      if (historicalMemo) {
        next = { ...next, memo: historicalMemo };
      }
    }
    return next;
  }

  function handleImport(imported: Transaction[], skippedRows: number) {
    setTransactions((prev) => [...prev, ...imported.map(withHistoricalDefaults)]);
    const duplicateCount = imported.filter((t) =>
      settledKeys.has(duplicateKey(t.date, t.description))
    ).length;
    setStatus({
      type: duplicateCount > 0 ? "error" : "success",
      message: `${imported.length}件を取り込みました。${
        skippedRows > 0 ? `(${skippedRows}件は形式を認識できず読み飛ばしました)` : ""
      }${
        duplicateCount > 0
          ? ` ⚠${duplicateCount}件は精算済みの明細と日付・内容が一致しています。一覧で「精算済み?」マークをご確認ください。`
          : ""
      }`,
    });
  }

  function handleChangeOrganization(id: string, organization: OrganizationId) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? organization === "exclude"
            ? { ...t, organization }
            : withHistoricalDefaults({ ...t, organization })
          : t
      )
    );
  }

  function handleChangeMemo(id: string, memo: string) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, memo } : t)));
  }

  function handleAddManualTransaction(transaction: Transaction) {
    setTransactions((prev) => [...prev, withHistoricalDefaults(transaction)]);
    setStatus({ type: "success", message: "決済を1件追加しました。" });
  }

  /** 手入力の明細(現金・カード(手入力))の打ち間違いを修正する。CSV取り込み分は対象外。 */
  function handleEditTransaction(
    id: string,
    patch: { date: string; paymentMethod: Transaction["paymentMethod"]; description: string; amount: number }
  ) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setStatus({ type: "success", message: "明細を更新しました。" });
  }

  function handleSortByDate() {
    setTransactions((prev) => [...prev].sort((a, b) => a.date.localeCompare(b.date)));
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

  /** 選択した明細を出張報告書タブへ経費として転記する。除外・精算済み扱いの明細は転記しない。 */
  function handleTranscribeToTripReport() {
    const selected = transactions.filter(
      (t) => selectedIds.has(t.id) && !(t.organization && NON_BILLABLE_ORGANIZATION_IDS.has(t.organization))
    );

    if (selected.length === 0) {
      setStatus({
        type: "error",
        message: "転記できる明細が選択されていません(「除外」「精算済み」の明細は転記できません)。",
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
   * 成功後は下書きをクリアして一覧画面に戻る。
   */
  async function handleFinalizeAndGeneratePdf() {
    setStatus(null);
    setBusy("pdf");
    try {
      const gasUrl = getGasUrl();
      const payload = buildSavePayload(transactions, {
        issueDate,
        status: "final",
        replaceSavedAt: editingSavedAt ?? undefined,
      });
      await saveTransactions(gasUrl, payload);
      await generateExpensePdf(aggregation, { issueDate, note });
      clearDraftTransactions();
      router.push("/");
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

  /**
   * 下書き保存: PDFは作らず、確定前のデータをスプレッドシートに下書きとして保存する。
   * 成功後は下書きをクリアして一覧画面に戻る(保存済みの内容は一覧の一番上に表示される)。
   */
  async function handleSaveDraft() {
    setStatus(null);
    setBusy("save");
    try {
      const gasUrl = getGasUrl();
      const payload = buildSavePayload(transactions, {
        issueDate,
        status: "draft",
        replaceSavedAt: editingSavedAt ?? undefined,
      });
      await saveTransactions(gasUrl, payload);
      clearDraftTransactions();
      router.push("/");
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof GasClientError
            ? err.message
            : `下書き保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(null);
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
          一覧に戻る
        </Link>
        <div>
          <h1 className="text-2xl font-bold">経費精算PDF作成</h1>
          <p className="text-sm text-muted-foreground">
            クレジットカード明細を仕分けして、組織ごとの経費精算PDFを作成します。
          </p>
        </div>
      </header>

      {editingSavedAt && (
        <Alert>
          一覧の既存データを編集しています。保存すると元のデータが置き換わります。
        </Alert>
      )}

      {!gasUrlConfigured && (
        <Alert variant="destructive">
          GAS WebアプリURLが未設定です。下書き保存・確定(PDF出力)を行うには、
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

      {previewOpen ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={busy !== null}>
              <Pencil className="mr-2 h-4 w-4" />
              編集に戻る
            </Button>
            <Button onClick={handleFinalizeAndGeneratePdf} disabled={busy !== null || !gasUrlConfigured}>
              {busy === "pdf" ? "確定・PDF作成中..." : "この内容でPDFを出力"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            実際に出力されるPDFのプレビューです。内容に問題がなければ「この内容でPDFを出力」を押してください。
            確定版としてスプレッドシートへの保存とPDFのダウンロードが行われ、一覧画面に戻ります。
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-slate-100 p-4 sm:p-8">
            <div
              className="mx-auto w-fit shadow-sm"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      ) : (
        <>
          <CsvUploader onImport={handleImport} importedFiles={importedFileNames} />

          <ManualEntryForm onAdd={handleAddManualTransaction} />

          <Card>
            <CardHeader>
              <CardTitle>明細の仕分け</CardTitle>
              <CardDescription>
                各明細の請求先組織を選択してください。プライベートの決済は「除外」、
                すでに他の方法で精算済みの明細は「精算済み」を選びます(いずれも集計・PDFの対象外)。
                チェックした明細は「出張報告書へ転記」で出張報告書タブの経費欄に追加できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <TransactionTable
                transactions={transactions}
                onChangeOrganization={handleChangeOrganization}
                onChangeMemo={handleChangeMemo}
                onEditTransaction={handleEditTransaction}
                onDelete={handleDelete}
                onSortByDate={handleSortByDate}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                settledKeys={settledKeys}
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
                「プレビューしてPDFを出力」でプレビュー画面を確認したうえで、確定版としてスプレッドシートに
                保存とPDF作成を行います。まだ確定しない下書き段階では「下書き保存」をご利用ください
                (保存後、一覧の一番上に追加されます)。
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setPreviewOpen(true)} disabled={busy !== null || !gasUrlConfigured}>
                  <Eye className="mr-2 h-4 w-4" />
                  プレビューしてPDFを出力
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSaveDraft}
                  disabled={busy !== null || !gasUrlConfigured}
                >
                  {busy === "save" ? "保存中..." : "下書き保存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
