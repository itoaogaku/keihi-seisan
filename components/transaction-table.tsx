"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ORGANIZATIONS, PAYMENT_METHOD_LABELS } from "@/lib/types";
import type { OrganizationId, Transaction } from "@/lib/types";
import { Trash2 } from "lucide-react";

interface TransactionTableProps {
  transactions: Transaction[];
  onChangeOrganization: (id: string, organization: OrganizationId) => void;
  onChangeMemo: (id: string, memo: string) => void;
  onDelete: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[], checked: boolean) => void;
}

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function TransactionTable({
  transactions,
  onChangeOrganization,
  onChangeMemo,
  onDelete,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: TransactionTableProps) {
  const [onlyUnclassified, setOnlyUnclassified] = useState(false);

  const visible = useMemo(
    () => (onlyUnclassified ? transactions.filter((t) => !t.organization) : transactions),
    [transactions, onlyUnclassified]
  );

  const allVisibleSelected = visible.length > 0 && visible.every((t) => selectedIds.has(t.id));

  const unclassifiedCount = transactions.filter((t) => !t.organization).length;

  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        まだ明細が取り込まれていません。上のフォームからCSVを取り込んでください。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span>全{transactions.length}件</span>
          {unclassifiedCount > 0 && (
            <Badge variant="destructive">未仕分け {unclassifiedCount}件</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOnlyUnclassified((v) => !v)}
        >
          {onlyUnclassified ? "すべて表示" : "未仕分けのみ表示"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(e) =>
                  onToggleSelectAll(
                    visible.map((t) => t.id),
                    e.target.checked
                  )
                }
                aria-label="表示中の明細をすべて選択"
              />
            </TableHead>
            <TableHead className="w-28">利用日</TableHead>
            <TableHead className="w-16">方法</TableHead>
            <TableHead>内容</TableHead>
            <TableHead className="w-28 text-right">金額</TableHead>
            <TableHead className="w-48">メモ</TableHead>
            <TableHead className="w-64">仕分け(請求先)</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.has(t.id)}
                  onChange={() => onToggleSelect(t.id)}
                  aria-label="この明細を選択"
                />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{t.date}</TableCell>
              <TableCell>
                <Badge variant={t.paymentMethod === "cash" ? "outline" : "secondary"}>
                  {PAYMENT_METHOD_LABELS[t.paymentMethod]}
                </Badge>
              </TableCell>
              <TableCell>{t.description}</TableCell>
              <TableCell className="text-right font-medium">{yen(t.amount)}</TableCell>
              <TableCell>
                <Input
                  value={t.organization === "exclude" ? "-" : t.memo}
                  onChange={(e) => onChangeMemo(t.id, e.target.value)}
                  placeholder="メモ"
                  className="h-9"
                  disabled={t.organization === "exclude"}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={t.organization ?? ""}
                  onChange={(e) => onChangeOrganization(t.id, e.target.value as OrganizationId)}
                  className={!t.organization ? "border-destructive text-destructive" : ""}
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {ORGANIZATIONS.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.label}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(t.id)}
                  aria-label="この明細を削除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
