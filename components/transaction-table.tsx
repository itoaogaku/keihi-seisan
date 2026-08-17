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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ORGANIZATIONS, ORGANIZATION_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/types";
import type { OrganizationId, PaymentMethod, Transaction } from "@/lib/types";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";

interface TransactionTableProps {
  transactions: Transaction[];
  onChangeOrganization: (id: string, organization: OrganizationId) => void;
  onChangeMemo: (id: string, memo: string) => void;
  onEditTransaction: (
    id: string,
    patch: { date: string; paymentMethod: PaymentMethod; description: string; amount: number }
  ) => void;
  onDelete: (id: string) => void;
  onSortByDate: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[], checked: boolean) => void;
  /** 「発行日|内容」のキー集合。一致する明細は精算済みとの重複候補として警告表示する。 */
  settledKeys?: Set<string>;
}

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function duplicateKey(date: string, description: string): string {
  return `${date}|${description.trim()}`;
}

/**
 * カード決済は、CSV取り込み由来(sourceFileあり)か手入力(sourceFileなし)かで
 * 見た目を分ける。現金は常に手入力のため区別不要。
 */
function paymentBadge(t: Transaction): { label: string; variant: "outline" | "secondary"; className?: string } {
  if (t.paymentMethod === "cash") {
    return { label: PAYMENT_METHOD_LABELS.cash, variant: "outline" };
  }
  if (!t.sourceFile) {
    return {
      label: "カード(手入力)",
      variant: "outline",
      className: "border-blue-300 bg-blue-50 text-blue-700",
    };
  }
  return { label: PAYMENT_METHOD_LABELS.card, variant: "secondary" };
}

export function TransactionTable({
  transactions,
  onChangeOrganization,
  onChangeMemo,
  onEditTransaction,
  onDelete,
  onSortByDate,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  settledKeys,
}: TransactionTableProps) {
  const [onlyUnclassified, setOnlyUnclassified] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("cash");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const visible = useMemo(
    () => (onlyUnclassified ? transactions.filter((t) => !t.organization) : transactions),
    [transactions, onlyUnclassified]
  );

  const allVisibleSelected = visible.length > 0 && visible.every((t) => selectedIds.has(t.id));

  const unclassifiedCount = transactions.filter((t) => !t.organization).length;

  function openEdit(t: Transaction) {
    setEditingId(t.id);
    setEditDate(t.date);
    setEditPaymentMethod(t.paymentMethod);
    setEditDescription(t.description);
    setEditAmount(String(t.amount));
  }

  function closeEdit() {
    setEditingId(null);
  }

  function saveEdit() {
    if (!editingId) return;
    const amountValue = Number(editAmount);
    if (!editDate || editDescription.trim() === "" || !(amountValue > 0)) return;
    onEditTransaction(editingId, {
      date: editDate,
      paymentMethod: editPaymentMethod,
      description: editDescription.trim(),
      amount: amountValue,
    });
    closeEdit();
  }

  const editValid =
    editDate !== "" && editDescription.trim() !== "" && Number(editAmount) > 0;

  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        まだ明細が取り込まれていません。上のフォームからCSVを取り込んでください。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span>全{transactions.length}件</span>
          {unclassifiedCount > 0 && (
            <Badge variant="destructive">未仕分け {unclassifiedCount}件</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSortByDate}>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            日付順に並び替え
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOnlyUnclassified((v) => !v)}
          >
            {onlyUnclassified ? "すべて表示" : "未仕分けのみ表示"}
          </Button>
        </div>
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
            <TableHead className="w-32">方法</TableHead>
            <TableHead>内容</TableHead>
            <TableHead className="w-28 text-right">金額</TableHead>
            <TableHead className="w-48">メモ</TableHead>
            <TableHead className="w-64">仕分け(請求先)</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((t) => {
            const isDuplicate = Boolean(
              settledKeys?.has(duplicateKey(t.date, t.description))
            );
            const isManual = !t.sourceFile;
            return (
            <TableRow key={t.id} className={isDuplicate ? "bg-amber-50" : undefined}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.has(t.id)}
                  onChange={() => onToggleSelect(t.id)}
                  aria-label="この明細を選択"
                />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{t.date}</TableCell>
              <TableCell className="whitespace-nowrap">
                {(() => {
                  const badge = paymentBadge(t);
                  return (
                    <Badge variant={badge.variant} className={badge.className}>
                      {badge.label}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>{t.description}</span>
                  {isDuplicate && (
                    <Badge
                      className="whitespace-nowrap border-amber-400 bg-amber-100 text-amber-800"
                      title="同じ利用日・内容の精算済み(発行済み)の明細が履歴にあります"
                    >
                      精算済み?
                    </Badge>
                  )}
                </div>
              </TableCell>
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
                  className={!t.organization ? "border-destructive text-destructive font-medium" : "font-medium"}
                  style={
                    t.organization
                      ? {
                          backgroundColor: ORGANIZATION_COLORS[t.organization].bg,
                          color: ORGANIZATION_COLORS[t.organization].text,
                          borderColor: ORGANIZATION_COLORS[t.organization].text,
                        }
                      : undefined
                  }
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {ORGANIZATIONS.map((org) => (
                    <option
                      key={org.id}
                      value={org.id}
                      style={{
                        backgroundColor: ORGANIZATION_COLORS[org.id].bg,
                        color: ORGANIZATION_COLORS[org.id].text,
                      }}
                    >
                      {org.label}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {isManual && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(t)}
                      aria-label="この明細を編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(t.id)}
                    aria-label="この明細を削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={editingId !== null}
        onClose={closeEdit}
        title="手入力の明細を編集"
        description="打ち間違いなどを修正できます(CSVから取り込んだ明細はここでは編集できません)。"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">支払日</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-payment-method">方法</Label>
              <Select
                id="edit-payment-method"
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">{PAYMENT_METHOD_LABELS.cash}</option>
                <option value="card">{PAYMENT_METHOD_LABELS.card}</option>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-description">内容</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">金額</Label>
              <Input
                id="edit-amount"
                type="number"
                min={0}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={closeEdit}>
              キャンセル
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={!editValid}>
              保存
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
