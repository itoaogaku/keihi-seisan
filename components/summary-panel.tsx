"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AggregationResult } from "@/lib/types";

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function SummaryPanel({ result }: { result: AggregationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. 集計結果</CardTitle>
        <CardDescription>現在の明細の集計です(除外・精算済みに仕分けた明細は含みません)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-primary px-5 py-4 text-primary-foreground">
          <span className="text-sm font-medium">合計請求額</span>
          <span className="text-2xl font-bold">{yen(result.grandTotal)}</span>
        </div>
        <div className="space-y-2">
          {result.byOrganization.map((org) => (
            <div
              key={org.organization}
              className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <p className="truncate text-sm font-medium">{org.label}</p>
                <p className="shrink-0 text-xs text-muted-foreground">{org.count}件</p>
              </div>
              <p className="shrink-0 font-semibold">{yen(org.total)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
