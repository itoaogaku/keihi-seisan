"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PeriodSelectorProps {
  closingDay: number;
  onChangeClosingDay: (day: number) => void;
  targetYearMonth: string;
  onChangeTargetYearMonth: (yearMonth: string) => void;
  periodStart: string;
  periodEnd: string;
}

export function PeriodSelector({
  closingDay,
  onChangeClosingDay,
  targetYearMonth,
  onChangeTargetYearMonth,
  periodStart,
  periodEnd,
}: PeriodSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. 集計期間(締め日)の設定</CardTitle>
        <CardDescription>
          締め日と対象年月から、集計対象期間を自動で算出します。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-6">
        <div className="space-y-1.5">
          <Label htmlFor="closing-day">締め日(毎月)</Label>
          <Input
            id="closing-day"
            type="number"
            min={1}
            max={31}
            className="w-24"
            value={closingDay}
            onChange={(e) => onChangeClosingDay(Number(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target-month">対象年月</Label>
          <Input
            id="target-month"
            type="month"
            className="w-44"
            value={targetYearMonth}
            onChange={(e) => onChangeTargetYearMonth(e.target.value)}
          />
        </div>
        <div className="rounded-md bg-muted px-4 py-2 text-sm">
          集計対象期間: <span className="font-semibold">{periodStart}</span> 〜{" "}
          <span className="font-semibold">{periodEnd}</span>
        </div>
      </CardContent>
    </Card>
  );
}
