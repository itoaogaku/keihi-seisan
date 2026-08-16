import { BILLABLE_ORGANIZATIONS } from "./types";
import type { AggregationResult, OrganizationSummary, Transaction } from "./types";

export function aggregateByOrganization(transactions: Transaction[]): AggregationResult {
  const byOrganization: OrganizationSummary[] = BILLABLE_ORGANIZATIONS.map((org) => {
    const orgTransactions = transactions
      .filter((t) => t.organization === org.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      organization: org.id,
      label: org.label,
      total: orgTransactions.reduce((sum, t) => sum + t.amount, 0),
      count: orgTransactions.length,
      transactions: orgTransactions,
    };
  });

  const grandTotal = byOrganization.reduce((sum, o) => sum + o.total, 0);

  return { grandTotal, byOrganization };
}
