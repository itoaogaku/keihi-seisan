"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import type { HistoryRecord, Transaction } from "@/lib/types";
import { organizationIdByLabel, organizationLabel, paymentMethodByLabel } from "@/lib/types";
import { getGasUrl, pushEditBuffer } from "@/lib/storage";
import { fetchHistory, GasClientError } from "@/lib/gas-client";
import { exportHistoryToCsv } from "@/lib/csv-export";

const ALL_ISSUE_DATES = "all";
const EXCLUDE_LABEL = organizationLabel("exclude");

interface HistoryEntry {
  savedAt: string;
  status: string;
  issueDate: string;
  records: HistoryRecord[];
  /** 除外(プライベート決済)を除いた金額合計・件数。PDF・集計と同じ扱いにしている。 */
  total: number;
  billableCount: number;
}

function yen(amount: number): string {
  return `¥${(Number(amount) || 0).toLocaleString("ja-JP")}`;
}

/** GASは1回の保存操作で複数行を同じsavedAtで書き込むため、savedAtでグループ化して1件分の保存操作として扱う。 */
function groupIntoEntries(records: HistoryRecord[]): HistoryEntry[] {
  const map = new Map<string, HistoryEntry>();
  for (const r of records) {
    let entry = map.get(r.savedAt);
    if (!entry) {
      entry = {
        savedAt: r.savedAt,
        status: r.status,
        issueDate: r.issueDate,
        records: [],
        total: 0,
        billableCount: 0,
      };
      map.set(r.savedAt, entry);
    }
    entry.records.push(r);
    if (r.organization !== EXCLUDE_LABEL) {
      entry.total += Number(r.amount) || 0;
      entry.billableCount += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export default function HomePage() {
  const router = useRouter();
  const [gasUrlConfigured, setGasUrlConfigured] = useState(true);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueDateFilter, setIssueDateFilter] = useState(ALL_ISSUE_DATES);
  const [expandedSavedAt, setExpandedSavedAt] = useState<string | null>(null);

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
      setRecords(fetched);
    } catch (err) {
      setError(err instanceof GasClientError ? err.message : "保存履歴の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(() => groupIntoEntries(records), [records]);

  const issueDates = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.issueDate).filter(Boolean))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [records]
  );

  const filteredEntries = useMemo(
    () =>
      issueDateFilter === ALL_ISSUE_DATES
        ? entries
        : entries.filter((e) => e.issueDate === issueDateFilter),
    [entries, issueDateFilter]
  );

  const filteredRecords = useMemo(
    () => filteredEntries.flatMap((e) => e.records),
    [filteredEntries]
  );

  const grandTotal = filteredEntries.reduce((sum, e) => sum + e.total, 0);

  function handleExport() {
    exportHistoryToCsv(
      filteredRecords,
      `経費精算_保存履歴_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  /** 保存済みのエントリを/newに読み込んで編集できるようにする。再保存時は元の行を置き換える。 */
  function handleEdit(entry: HistoryEntry) {
    const transactions: Transaction[] = entry.records.map((r) => ({
      id: crypto.randomUUID(),
      date: r.date,
      description: r.description,
      amount: Number(r.amount) || 0,
      organization: organizationIdByLabel(r.organization),
      memo: r.memo,
      paymentMethod: paymentMethodByLabel(r.paymentMethod),
    }));

    pushEditBuffer({ transactions, issueDate: entry.issueDate, savedAt: entry.savedAt });
    router.push("/new");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">経費精算</h1>
          <p className="text-sm text-muted-foreground">
            保存済みの経費精算データの一覧です。クリックすると明細を確認できます。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/business-trip-report">
            <Button variant="outline" size="sm">
              <Plane className="mr-2 h-4 w-4" />
              出張報告書
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              設定
            </Button>
          </Link>
          <Link href="/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              新規作成
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
          であなた自身のURLを登録すると、保存済みの履歴を表示できます。「新規作成」からの作業自体は設定なしでも始められます。
        </Alert>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>一覧</CardTitle>
            <CardDescription>
              {filteredEntries.length > 0 ? (
                <>
                  全{filteredEntries.length}件 合計{yen(grandTotal)}
                </>
              ) : (
                "保存済みのデータ"
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
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredRecords.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSVで書き出す
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">読み込み中...</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {gasUrlConfigured
                ? "保存されているデータはまだありません。「新規作成」から作成してください。"
                : "GAS WebアプリURLを設定すると、ここに保存済みのデータが表示されます。"}
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              選択した発行日のデータはありません。
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry) => {
                const isExpanded = expandedSavedAt === entry.savedAt;
                return (
                  <div key={entry.savedAt} className="rounded-md border border-border">
                    <div className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedSavedAt(isExpanded ? null : entry.savedAt)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedSavedAt(isExpanded ? null : entry.savedAt);
                          }
                        }}
                        className="flex flex-1 cursor-pointer items-center gap-3 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <Badge variant={entry.status === "発行済み" ? "success" : "outline"}>
                          {entry.status}
                        </Badge>
                        <span className="text-sm font-medium">発行日: {entry.issueDate}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.billableCount}件
                          {entry.records.length > entry.billableCount &&
                            `(除外${entry.records.length - entry.billableCount}件)`}
                        </span>
                        <span className="ml-auto font-semibold">{yen(entry.total)}</span>
                        <span className="w-36 shrink-0 text-right text-xs text-muted-foreground">
                          {entry.savedAt}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(entry)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        編集
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">利用日</TableHead>
                              <TableHead className="w-16">方法</TableHead>
                              <TableHead className="w-56">請求先組織</TableHead>
                              <TableHead>内容</TableHead>
                              <TableHead>メモ</TableHead>
                              <TableHead className="w-28 text-right">金額</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.records.map((r, i) => {
                              const isExcluded = r.organization === EXCLUDE_LABEL;
                              return (
                                <TableRow
                                  key={`${r.date}-${r.description}-${i}`}
                                  className={isExcluded ? "text-muted-foreground" : undefined}
                                >
                                  <TableCell className="whitespace-nowrap text-muted-foreground">
                                    {r.date}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={r.paymentMethod === "現金" ? "outline" : "secondary"}
                                    >
                                      {r.paymentMethod}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{r.organization}</TableCell>
                                  <TableCell>{r.description}</TableCell>
                                  <TableCell className="text-muted-foreground">{r.memo}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {yen(r.amount)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
