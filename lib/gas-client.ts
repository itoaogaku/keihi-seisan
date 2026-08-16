import type { Transaction } from "./types";
import { organizationLabel, PAYMENT_METHOD_LABELS } from "./types";

export interface SavePayload {
  period: { start: string; end: string };
  savedAt: string;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    organization: string;
    organizationName: string;
    memo: string;
    paymentMethod: string;
    paymentMethodLabel: string;
  }>;
}

export interface GasResponse {
  status: "ok" | "error";
  message?: string;
  saved?: number;
  [key: string]: unknown;
}

export class GasClientError extends Error {}

function assertValidUrl(gasUrl: string) {
  if (!gasUrl) {
    throw new GasClientError(
      "GAS WebアプリURLが設定されていません。「設定」画面で登録してください。"
    );
  }
  try {
    const url = new URL(gasUrl);
    if (!url.hostname.endsWith("script.google.com")) {
      throw new GasClientError(
        "GAS WebアプリURLの形式が正しくないようです(script.google.com のURLを指定してください)。"
      );
    }
  } catch {
    throw new GasClientError("GAS WebアプリURLの形式が正しくありません。");
  }
}

async function parseGasResponse(response: Response): Promise<GasResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as GasResponse;
  } catch {
    throw new GasClientError(
      `GASからの応答を解析できませんでした(デプロイ設定を確認してください): ${text.slice(0, 200)}`
    );
  }
}

export function buildSavePayload(
  transactions: Transaction[],
  period: { start: string; end: string }
): SavePayload {
  return {
    period,
    savedAt: new Date().toISOString(),
    transactions: transactions
      .filter((t) => t.organization && t.organization !== "exclude")
      .map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        organization: t.organization as string,
        organizationName: organizationLabel(t.organization),
        memo: t.memo,
        paymentMethod: t.paymentMethod,
        paymentMethodLabel: PAYMENT_METHOD_LABELS[t.paymentMethod],
      })),
  };
}

/**
 * GAS Web App へ確定済みデータを保存する。
 * Content-Type を text/plain にすることで、GAS が正しく処理できない
 * CORS プリフライト(OPTIONS)を発生させないようにしている。
 */
export async function saveTransactions(
  gasUrl: string,
  payload: SavePayload
): Promise<GasResponse> {
  assertValidUrl(gasUrl);

  let response: Response;
  try {
    response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new GasClientError(
      `GASへの接続に失敗しました。URLとデプロイ設定(アクセス:全員)を確認してください。(${
        err instanceof Error ? err.message : String(err)
      })`
    );
  }

  const data = await parseGasResponse(response);
  if (data.status !== "ok") {
    throw new GasClientError(data.message ?? "GAS側でエラーが発生しました。");
  }
  return data;
}

export async function testConnection(gasUrl: string): Promise<GasResponse> {
  assertValidUrl(gasUrl);

  let response: Response;
  try {
    response = await fetch(gasUrl, { method: "GET" });
  } catch (err) {
    throw new GasClientError(
      `GASへの接続に失敗しました。URLとデプロイ設定(アクセス:全員)を確認してください。(${
        err instanceof Error ? err.message : String(err)
      })`
    );
  }

  const data = await parseGasResponse(response);
  if (data.status !== "ok") {
    throw new GasClientError(data.message ?? "GAS側でエラーが発生しました。");
  }
  return data;
}
