"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TripReport } from "@/lib/types";
import { popTripReportTransfer, saveTripReport } from "@/lib/trip-report-storage";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 新規の出張報告書を1件作成してすぐに編集画面へ遷移するだけの画面。
 * 経費精算PDF作成画面からの転記データがあれば、そのまま出張経費欄に反映する。
 */
export default function NewTripReportPage() {
  const router = useRouter();

  // 生成・転記の消費・遷移を1回だけ行う(React 18開発モードのeffect二重実行対策)。
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const transferred = popTripReportTransfer();
    const now = new Date().toISOString();
    const report: TripReport = {
      id: crypto.randomUUID(),
      updatedAt: now,
      reportDate: today(),
      applicantName: "",
      tripDate: today(),
      location: "",
      purpose: "",
      content: "",
      memo: "",
      expenses: transferred,
    };
    saveTripReport(report);
    router.replace(`/business-trip-report/${report.id}`);
  }, [router]);

  return <p className="py-8 text-center text-sm text-muted-foreground">作成中...</p>;
}
