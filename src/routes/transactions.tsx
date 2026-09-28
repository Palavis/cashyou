import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Trash2, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CategorySelect } from "@/components/category-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildPathIndex,
  saveMerchantRule,
  useCategories,
  useDeleteTransaction,
  useSession,
  useTransactions,
  useUpdateTransaction,
} from "@/lib/data";
import { enrich, availableMonths } from "@/lib/analytics";
import { money, formatFullDate, monthKey, monthLabel } from "@/lib/format";
import { normalizeMerchant, type TxnType } from "@/lib/merchants";
import { cn } from "@/lib/utils";

interface TxnSearch {
  q?: string | undefined;
  group?: string | undefined;
  month?: string | undefined;
  type?: string | undefined;
}

export const Route = createFileRoute("/transactions")({
  validateSearch: (search: Record<string, unknown>): TxnSearch => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
    group: typeof search["group"] === "string" ? (search["group"] as string) : undefined,
    month: typeof search["month"] === "string" ? (search["month"] as string) : undefined,
    type: typeof search["type"] === "string" ? (search["type"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Transactions — SpendWise" },
      {
        name: "description",
        content: "Search, filter and correct every transaction you have imported into SpendWise.",
      },
      { property: "og:title", content: "Transactions — SpendWise" },
      { property: "og:description", content: "Search and correct your imported transactions." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <TransactionsPage />
    </AppShell>
  ),
});

function TransactionsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/transactions" });
  const { user } = useSession();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const [query, setQuery] = useState(search.q ?? "");

  const index = useMemo(() => buildPathIndex(categories), [categories]);
  const all = useMemo(() => enrich(transactions, index.byId), [transactions, index]);
  const months = useMemo(() => availableMonths(all), [all]);

  const month = search.month && search.month !== "all" ? search.month : "all";
  const type = search.type ?? "all";
  const group = search.group;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      if (month !== "all" && monthKey(t.txn_date) !== month) return false;
      if (type !== "all" && t.txn_type !== type) return false;
      if (group && t.group !== group) return false;
      if (!q) return true;
      return (
        t.merchant.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.categoryPath.toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      );
    });
  }, [all, query, month, type, group]);

  const totalShown = rows.reduce(
    (sum, t) => sum + (t.txn_type === "expense" ? t.amount : 0),
    0,
  );

  function setSearch(patch: Partial<TxnSearch>) {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  }

  async function changeCategory(id: string, merchant: string, path: string, txnType: TxnType) {
    const categoryId = index.byPath.get(path) ?? null;
    await update.mutateAsync({ id, patch: { category_id: categoryId, confidence: 1 } });
    if (user) {
      await saveMerchantRule(user.id, normalizeMerchant(merchant), categoryId, txnType);
      toast.success(`Remembered: ${merchant} → ${path}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} shown · {money(totalShown)} spent
        </p>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search merchants, amounts, categories…"
                className="pl-9"
              />
            </div>
            <Select value={month} onValueChange={(v) => setSearch({ month: v })}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setSearch({ type: v })}>
              <SelectTrigger className="w-full md:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer">Transfers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {group ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                Category: {group}
                <button onClick={() => setSearch({ group: undefined })} aria-label="Clear category filter">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          ) : null}
          <CardTitle className="sr-only">Transaction list</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-y bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Merchant</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className={cn("border-b last:border-0", t.excluded && "opacity-40")}>
                    <td className="num whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {formatFullDate(t.txn_date)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{t.merchant}</p>
                      <p className="max-w-xs truncate text-xs text-muted-foreground">{t.description}</p>
                    </td>
                    <td
                      className={cn(
                        "num whitespace-nowrap px-3 py-3 text-right font-medium",
                        t.txn_type === "income" ? "text-income" : t.txn_type === "expense" ? "text-expense" : "text-transfer",
                      )}
                    >
                      {money(t.amount, true)}
                    </td>
                    <td className="px-3 py-3">
                      <Select
                        value={t.txn_type}
                        onValueChange={(v) =>
                          update.mutate({ id: t.id, patch: { txn_type: v as TxnType } })
                        }
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <CategorySelect
                        categories={categories}
                        value={t.categoryPath}
                        onChange={(path) => void changeCategory(t.id, t.merchant, path, t.txn_type)}
                        className="h-8 w-52 text-xs"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={t.excluded ? "Include in totals" : "Exclude from totals"}
                          onClick={() => update.mutate({ id: t.id, patch: { excluded: !t.excluded } })}
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete"
                          onClick={() => remove.mutate(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-14 text-center text-sm text-muted-foreground">
                      No transactions match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
