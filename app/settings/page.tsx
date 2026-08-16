"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ArrowLeft } from "lucide-react";
import { clearGasUrl, getGasUrl, setGasUrl } from "@/lib/storage";
import { GasClientError, testConnection } from "@/lib/gas-client";

export default function SettingsPage() {
  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    const current = getGasUrl();
    setUrl(current);
    setSavedUrl(current);
  }, []);

  function handleSave() {
    setGasUrl(url);
    setSavedUrl(url.trim());
    setStatus({ type: "success", message: "GAS WebアプリURLを保存しました。" });
  }

  function handleClear() {
    clearGasUrl();
    setUrl("");
    setSavedUrl("");
    setStatus({ type: "success", message: "設定を削除しました。" });
  }

  async function handleTest() {
    setStatus(null);
    setTesting(true);
    try {
      await testConnection(url);
      setStatus({ type: "success", message: "接続に成功しました。GASが正しく応答しています。" });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof GasClientError ? err.message : "接続テストに失敗しました。",
      });
    } finally {
      setTesting(false);
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
          戻る
        </Link>
        <h1 className="text-2xl font-bold">設定(接続設定)</h1>
        <p className="text-sm text-muted-foreground">
          あなた専用のGoogle Apps Script(GAS) WebアプリURLを登録します。この設定はこのブラウザにのみ保存され、他の人とは共有されません。
        </p>
      </header>

      {status && (
        <Alert variant={status.type === "success" ? "success" : "destructive"}>
          {status.message}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>GAS WebアプリURL</CardTitle>
          <CardDescription>
            自分のGoogleスプレッドシートに紐づくGASをWebアプリとしてデプロイし、そのURLをここに貼り付けてください。
            (デプロイ手順はリポジトリ内の <code>gas/README.md</code> を参照)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gas-url">URL</Label>
            <Input
              id="gas-url"
              placeholder="https://script.google.com/macros/s/xxxxx/exec"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={!url.trim()}>
              保存
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={!url.trim() || testing}>
              {testing ? "テスト中..." : "接続テスト"}
            </Button>
            <Button variant="ghost" onClick={handleClear} disabled={!savedUrl}>
              設定を削除
            </Button>
          </div>
          {savedUrl && (
            <p className="text-xs text-muted-foreground">現在保存されているURL: {savedUrl}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>なぜブラウザに保存するのですか?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            このアプリはサーバー側にデータベースを持ちません。各自のGAS
            WebアプリURLをブラウザのlocalStorageにのみ保存し、データ送信はそのURL宛に直接行われます。
          </p>
          <p>
            そのため、同じURL(このWebアプリ)を同僚と共有しても、各自が自分自身のGoogleアカウント・スプレッドシートにのみデータを保存することになり、データが混ざる心配はありません。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
