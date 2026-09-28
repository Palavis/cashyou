import { monthKey } from "./format";
import type { TransactionRow } from "./data";

export interface EnrichedTxn extends TransactionRow {
  categoryPath: string;
  group: string;
  leaf: string;
}

export function enrich(
  transactions: TransactionRow[],
  pathById: Map<string, string>,
): EnrichedTxn[] {
  return transactions.map((t) => {
    const path = (t.category_id && pathById.get(t.category_id)) || "Other > Uncategorized";
    const parts = path.split(" > ");
    const group = parts[0] ?? path;
    return { ...t, categoryPath: path, group, leaf: parts[1] ?? group };
  });
}

export function totals(txns: EnrichedTxn[]) {
  let income = 0;
  let expenses = 0;
  let transfers = 0;
  for (const t of txns) {
    if (t.excluded) continue;
    if (t.txn_type === "income") income += t.amount;
    else if (t.txn_type === "expense") expenses += t.amount;
    else transfers += t.amount;
  }
  const net = income - expenses;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;
  return { income, expenses, transfers, net, savingsRate };
}

export function byCategory(txns: EnrichedTxn[], type: "expense" | "income" = "expense") {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.excluded || t.txn_type !== type) continue;
    map.set(t.group, (map.get(t.group) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function bySubcategory(txns: EnrichedTxn[], type: "expense" | "income" = "expense") {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.excluded || t.txn_type !== type) continue;
    map.set(t.categoryPath, (map.get(t.categoryPath) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function byMonth(txns: EnrichedTxn[]) {
  const map = new Map<string, { month: string; income: number; expenses: number }>();
  for (const t of txns) {
    if (t.excluded || t.txn_type === "transfer") continue;
    const key = monthKey(t.txn_date);
    const entry = map.get(key) ?? { month: key, income: 0, expenses: 0 };
    if (t.txn_type === "income") entry.income += t.amount;
    else entry.expenses += t.amount;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function byDay(txns: EnrichedTxn[]) {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.excluded || t.txn_type !== "expense") continue;
    map.set(t.txn_date, (map.get(t.txn_date) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function topMerchants(txns: EnrichedTxn[], limit = 8) {
  const map = new Map<string, { name: string; value: number; count: number }>();
  for (const t of txns) {
    if (t.excluded || t.txn_type !== "expense") continue;
    const name = t.merchant || "Unknown";
    const entry = map.get(name) ?? { name, value: 0, count: 0 };
    entry.value += t.amount;
    entry.count += 1;
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

export interface Recurring {
  merchant: string;
  category: string;
  averageAmount: number;
  occurrences: number;
  cadence: "monthly" | "weekly" | "quarterly" | "yearly";
  lastDate: string;
  monthlyEstimate: number;
}

/** Detects likely recurring payments: same merchant, similar amount, regular gap. */
export function detectRecurring(txns: EnrichedTxn[]): Recurring[] {
  const groups = new Map<string, EnrichedTxn[]>();
  for (const t of txns) {
    if (t.excluded || t.txn_type === "income") continue;
    const key = t.merchant || t.description.slice(0, 18);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const out: Recurring[] = [];
  for (const [merchant, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a.txn_date.localeCompare(b.txn_date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(
        (new Date(sorted[i]!.txn_date).getTime() - new Date(sorted[i - 1]!.txn_date).getTime()) /
          86400000,
      );
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const gapSpread =
      gaps.reduce((a, b) => a + Math.abs(b - avgGap), 0) / gaps.length / Math.max(avgGap, 1);

    const amounts = sorted.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountSpread =
      amounts.reduce((a, b) => a + Math.abs(b - avgAmount), 0) / amounts.length / Math.max(avgAmount, 1);

    if (amountSpread > 0.35 || gapSpread > 0.45) continue;

    let cadence: Recurring["cadence"] = "monthly";
    if (avgGap <= 10) cadence = "weekly";
    else if (avgGap <= 45) cadence = "monthly";
    else if (avgGap <= 120) cadence = "quarterly";
    else cadence = "yearly";

    const perMonth =
      cadence === "weekly" ? 4.33 : cadence === "monthly" ? 1 : cadence === "quarterly" ? 1 / 3 : 1 / 12;

    out.push({
      merchant,
      category: sorted[sorted.length - 1]!.categoryPath,
      averageAmount: avgAmount,
      occurrences: sorted.length,
      cadence,
      lastDate: sorted[sorted.length - 1]!.txn_date,
      monthlyEstimate: avgAmount * perMonth,
    });
  }
  return out.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}

export function compareMonths(txns: EnrichedTxn[], current: string, previous: string) {
  const currentTxns = txns.filter((t) => monthKey(t.txn_date) === current);
  const previousTxns = txns.filter((t) => monthKey(t.txn_date) === previous);
  const cur = byCategory(currentTxns);
  const prev = byCategory(previousTxns);
  const prevMap = new Map(prev.map((c) => [c.name, c.value]));
  const deltas = cur
    .map((c) => ({ name: c.name, delta: c.value - (prevMap.get(c.name) ?? 0), value: c.value }))
    .concat(
      prev
        .filter((p) => !cur.some((c) => c.name === p.name))
        .map((p) => ({ name: p.name, delta: -p.value, value: 0 })),
    )
    .sort((a, b) => b.delta - a.delta);

  return {
    current: totals(currentTxns),
    previous: totals(previousTxns),
    biggestIncrease: deltas[0],
    biggestDecrease: deltas[deltas.length - 1],
    categories: cur,
  };
}

export function availableMonths(txns: EnrichedTxn[]) {
  return [...new Set(txns.map((t) => monthKey(t.txn_date)))].sort((a, b) => b.localeCompare(a));
}
