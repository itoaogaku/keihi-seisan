"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Transaction } from "@/lib/types";

interface CashEntryFormProps {
  onAdd: (transaction: Transaction) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CashEntryForm({ onAdd }: CashEntryFormProps) {
  const [date, setDate] = useState(today());
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
      paymentMethod: "cash",
    });
    setDescription("");
    setAmount("");
    setMemo("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>現金決済の追加</CardTitle>
        <CardDescription>
          カード明細に含まれない現金でのお支払いは、こちらから1件ずつ追加してください。追加後は下の一覧で仕分けできます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr_8rem_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="cash-date">支払日</Label>
            <Input id="cash-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-description">内容</Label>
            <Input
              id="cash-description"
              placeholder="〇〇文具店"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-amount">金額</Label>
            <Input
              id="cash-amount"
              type="number"
              min={0}
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-memo">メモ(任意)</Label>
            <Input
              id="cash-memo"
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
