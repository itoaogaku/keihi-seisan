export type OrganizationId = "exclude" | "orgA" | "orgB" | "orgC" | "orgD";

export interface OrganizationDef {
  id: OrganizationId;
  label: string;
  /** 除外(プライベート決済)は集計・PDF・保存の対象外 */
  isBillable: boolean;
}

export const ORGANIZATIONS: OrganizationDef[] = [
  { id: "exclude", label: "除外(プライベート決済)", isBillable: false },
  { id: "orgA", label: "株式会社アスリートキャリアセンター", isBillable: true },
  { id: "orgB", label: "株式会社原D&S", isBillable: true },
  { id: "orgC", label: "一般社団法人アスリートセンター", isBillable: true },
  { id: "orgD", label: "青山学院大学陸上競技部", isBillable: true },
];

export const BILLABLE_ORGANIZATIONS = ORGANIZATIONS.filter((o) => o.isBillable);

export function organizationLabel(id: OrganizationId | null): string {
  if (!id) return "未仕分け";
  return ORGANIZATIONS.find((o) => o.id === id)?.label ?? id;
}

export type PaymentMethod = "card" | "cash";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "カード",
  cash: "現金",
};

export interface Transaction {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  description: string;
  amount: number;
  organization: OrganizationId | null;
  memo: string;
  paymentMethod: PaymentMethod;
}

export interface OrganizationSummary {
  organization: OrganizationId;
  label: string;
  total: number;
  count: number;
  transactions: Transaction[];
}

export interface AggregationResult {
  periodStart: string;
  periodEnd: string;
  grandTotal: number;
  byOrganization: OrganizationSummary[];
}

/** スプレッドシートに保存済みの明細1件(GASの一覧取得APIが返す形) */
export interface HistoryRecord {
  savedAt: string;
  periodStart: string;
  periodEnd: string;
  date: string;
  paymentMethod: string;
  description: string;
  memo: string;
  amount: number;
  organization: string;
}
