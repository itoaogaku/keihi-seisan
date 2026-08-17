"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseTransactionsFromText } from "@/lib/csv-parser";
import { decodeCsvArrayBuffer } from "@/lib/encoding";
import type { Transaction } from "@/lib/types";
import { Upload } from "lucide-react";

interface CsvUploaderProps {
  onImport: (transactions: Transaction[], skippedRows: number) => void;
  /** 現在の明細に含まれる、取り込み済みCSVファイル名の一覧(重複なし)。 */
  importedFiles?: string[];
}

export function CsvUploader({ onImport, importedFiles = [] }: CsvUploaderProps) {
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvArrayBuffer(buffer);
    const { transactions, skippedRows } = parseTransactionsFromText(text);
    onImport(
      transactions.map((t) => ({ ...t, sourceFile: file.name })),
      skippedRows
    );
  }

  function handlePasteImport() {
    if (!pasteText.trim()) return;
    const { transactions, skippedRows } = parseTransactionsFromText(pasteText);
    onImport(transactions, skippedRows);
    setPasteText("");
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>1. 明細の取り込み</CardTitle>
            <CardDescription>
              クレジットカード会社からダウンロードしたCSVファイルを取り込んでください。
            </CardDescription>
          </div>
          {importedFiles.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {importedFiles.map((f) => (
                <Badge key={f} variant="secondary" className="whitespace-nowrap">
                  {f} 読み込み済み
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground"
          >
            <Upload className="h-6 w-6" />
            <p>CSVファイルをドラッグ&ドロップ、またはクリックして選択</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              ファイルを選択
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>テキストを貼り付けて取り込む</CardTitle>
          <CardDescription>
            CSVファイルの代わりに、明細をコピーしてこちらに貼り付けても取り込めます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={"2026/08/01,〇〇文具店,3200\n2026/08/03,△△カフェ,850"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <Button size="sm" onClick={handlePasteImport} disabled={!pasteText.trim()}>
            貼り付けた内容を取り込む
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
