export type OrganizationId = "exclude" | "settled" | "orgA" | "orgB" | "orgC" | "orgD";

export interface OrganizationDef {
  id: OrganizationId;
  label: string;
  /** 除外(プライベート決済)・精算済みは集計・PDF・保存の対象外 */
  isBillable: boolean;
}

export const ORGANIZATIONS: OrganizationDef[] = [
  { id: "exclude", label: "除外(プライベート決済)", isBillable: false },
  { id: "settled", label: "精算済み(請求対象外)", isBillable: false },
  { id: "orgA", label: "株式会社アスリートキャリアセンター", isBillable: true },
  { id: "orgB", label: "株式会社原D&S", isBillable: true },
  { id: "orgC", label: "一般社団法人アスリートセンター", isBillable: true },
  { id: "orgD", label: "青山学院大学陸上競技部", isBillable: true },
];

export const BILLABLE_ORGANIZATIONS = ORGANIZATIONS.filter((o) => o.isBillable);

/** 除外・精算済みなど、集計・PDF・保存対象外の組織IDの集合。 */
export const NON_BILLABLE_ORGANIZATION_IDS = new Set(
  ORGANIZATIONS.filter((o) => !o.isBillable).map((o) => o.id)
);

export function organizationLabel(id: OrganizationId | null): string {
  if (!id) return "未仕分け";
  return ORGANIZATIONS.find((o) => o.id === id)?.label ?? id;
}

/** 組織名(表示ラベル)からOrganizationIdを逆引きする。保存済みデータの編集読み込み用。 */
export function organizationIdByLabel(label: string): OrganizationId | null {
  return ORGANIZATIONS.find((o) => o.label === label)?.id ?? null;
}

/** 仕分けプルダウンの視認性向上のための、請求先ごとの色。青山学院大学陸上競技部(orgD)は緑。 */
export const ORGANIZATION_COLORS: Record<OrganizationId, { bg: string; text: string }> = {
  exclude: { bg: "#f3f4f6", text: "#4b5563" },
  settled: { bg: "#ede9fe", text: "#5b21b6" },
  orgA: { bg: "#dbeafe", text: "#1e3a8a" },
  orgB: { bg: "#fef3c7", text: "#78350f" },
  orgC: { bg: "#fce7f3", text: "#831843" },
  orgD: { bg: "#dcfce7", text: "#166534" },
};

export type PaymentMethod = "card" | "cash";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "カード",
  cash: "現金",
};

/** 表示ラベルからPaymentMethodを逆引きする。保存済みデータの編集読み込み用。 */
export function paymentMethodByLabel(label: string): PaymentMethod {
  return label === PAYMENT_METHOD_LABELS.cash ? "cash" : "card";
}

/** draft: 下書き保存 / final: 経費精算PDF出力とあわせて行う確定保存 */
export type SaveStatus = "draft" | "final";

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  draft: "下書き",
  final: "発行済み",
};

export interface Transaction {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  description: string;
  amount: number;
  organization: OrganizationId | null;
  memo: string;
  paymentMethod: PaymentMethod;
  /** CSVファイルから取り込んだ場合の、取り込み元ファイル名(手入力・貼り付けの場合は未設定)。 */
  sourceFile?: string;
}

export interface OrganizationSummary {
  organization: OrganizationId;
  label: string;
  total: number;
  count: number;
  transactions: Transaction[];
}

export interface AggregationResult {
  grandTotal: number;
  byOrganization: OrganizationSummary[];
}

/** 出張報告書の経費テーブル1行 */
export interface TripExpenseRow {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  description: string;
  amount: number;
  note: string; // 備考
}

/** 出張報告書1件分のデータ */
export interface TripReport {
  id: string;
  updatedAt: string; // ISO日時。一覧の並び替えに使う
  reportDate: string; // 右上の「日時」(報告書の発行日)
  applicantName: string; // 氏名
  tripDate: string; // 出張の「日時」
  location: string; // 場所
  purpose: string; // 目的
  content: string; // 報告内容
  memo: string; // 社内用メモ(PDF出力には含めない)
  expenses: TripExpenseRow[];
}

/** スプレッドシートに保存済みの明細1件(GASの一覧取得APIが返す形) */
export interface HistoryRecord {
  savedAt: string;
  status: string;
  issueDate: string;
  date: string;
  paymentMethod: string;
  description: string;
  memo: string;
  amount: number;
  organization: string;
  /** CSVファイルから取り込んだ場合の取り込み元ファイル名(手入力・貼り付けの場合は空文字)。 */
  sourceFile: string;
}
