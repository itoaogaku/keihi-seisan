import type { HistoryRecord, SaveStatus, Transaction, TripReport } from "./types";
import { organizationLabel, PAYMENT_METHOD_LABELS, SAVE_STATUS_LABELS } from "./types";

export interface SavePayload {
  savedAt: string;
  issueDate: string;
  status: SaveStatus;
  statusLabel: string;
  /** 編集元の保存日時。指定すると、GAS側で同じ保存日時の既存行を削除してから保存し直す(上書き編集用)。 */
  replaceSavedAt?: string;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    organization: string;
    organizationName: string;
    memo: string;
    paymentMethod: string;
    paymentMethodLabel: string;
    sourceFile: string;
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
  meta: { issueDate: string; status: SaveStatus; replaceSavedAt?: string }
): SavePayload {
  return {
    savedAt: new Date().toISOString(),
    issueDate: meta.issueDate,
    status: meta.status,
    statusLabel: SAVE_STATUS_LABELS[meta.status],
    replaceSavedAt: meta.replaceSavedAt,
    // 「除外」の明細もスプレッドシートには保存する(PDF・集計には含めない)。
    // こうしないと、保存後に一覧から編集し直したときに除外した明細が復元できず消えてしまう。
    transactions: transactions
      .filter((t) => t.organization !== null)
      .map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        organization: t.organization as string,
        organizationName: organizationLabel(t.organization),
        memo: t.memo,
        paymentMethod: t.paymentMethod,
        paymentMethodLabel: PAYMENT_METHOD_LABELS[t.paymentMethod],
        sourceFile: t.sourceFile ?? "",
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

/**
 * これまでにスプレッドシートへ保存した明細を、締め日などによる絞り込みなしで
 * 全件取得する(履歴タブ用)。
 */
export async function fetchHistory(gasUrl: string): Promise<HistoryRecord[]> {
  assertValidUrl(gasUrl);

  const url = new URL(gasUrl);
  url.searchParams.set("action", "list");

  let response: Response;
  try {
    response = await fetch(url.toString(), { method: "GET" });
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
  return Array.isArray(data.records) ? (data.records as HistoryRecord[]) : [];
}

/**
 * 指定した保存日時(savedAt)のエントリ(同じ保存操作で書き込まれた全行)を
 * スプレッドシートから削除する。一覧画面の「削除」から呼び出す。
 */
export async function deleteHistoryEntry(gasUrl: string, savedAt: string): Promise<GasResponse> {
  assertValidUrl(gasUrl);

  let response: Response;
  try {
    response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete", savedAt }),
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

/**
 * 出張報告書をスプレッドシートへ保存する(idが一致する行があれば上書き)。
 * エディタ画面での自動保存から、変更のたびにデバウンスして呼び出される。
 */
export async function saveTripReportRemote(gasUrl: string, report: TripReport): Promise<GasResponse> {
  assertValidUrl(gasUrl);

  let response: Response;
  try {
    response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "saveTripReport", report }),
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

/** スプレッドシートから指定idの出張報告書を削除する。 */
export async function deleteTripReportRemote(gasUrl: string, id: string): Promise<GasResponse> {
  assertValidUrl(gasUrl);

  let response: Response;
  try {
    response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "deleteTripReport", id }),
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

/** スプレッドシートに保存済みの出張報告書を全件取得する。 */
export async function fetchTripReports(gasUrl: string): Promise<TripReport[]> {
  assertValidUrl(gasUrl);

  const url = new URL(gasUrl);
  url.searchParams.set("action", "listTripReports");

  let response: Response;
  try {
    response = await fetch(url.toString(), { method: "GET" });
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
  return Array.isArray(data.reports) ? (data.reports as TripReport[]) : [];
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
