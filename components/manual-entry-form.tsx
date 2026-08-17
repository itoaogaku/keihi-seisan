"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { PaymentMethod, Transaction } from "@/lib/types";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";

interface ManualEntryFormProps {
  onAdd: (transaction: Transaction) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualEntryForm({ onAdd }: ManualEntryFormProps) {
  const [date, setDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const amountValue = Number(amount);
  const isValid = date !== "" && description.trim() !== "" && amountValue > 0;

  function handleAdd() {
    if (!isValid) return;
    onAdd({
      id: crypto.randomUUID(),
      date,
      description: description.trim(),
      amount: amountValue,
      organization: null,
      memo: memo.trim(),
      paymentMethod,
    });
    setDescription("");
    setAmount("");
    setMemo("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>決済の追加(手入力)</CardTitle>
        <CardDescription>
          CSV明細に含まれない決済は、こちらから1件ずつ追加してください。追加後は下の一覧で仕分けできます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-[9rem_7rem_1fr_8rem_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="manual-date">支払日</Label>
            <Input id="manual-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-payment-method">方法</Label>
            <Select
              id="manual-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">{PAYMENT_METHOD_LABELS.cash}</option>
              <option value="card">{PAYMENT_METHOD_LABELS.card}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-description">内容</Label>
            <Input
              id="manual-description"
              placeholder="〇〇文具店"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-amount">金額</Label>
            <Input
              id="manual-amount"
              type="number"
              min={0}
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-memo">メモ(任意)</Label>
            <Input
              id="manual-memo"
              placeholder="領収書あり など"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={!isValid}>
            追加
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
