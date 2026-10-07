import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Repeat, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildPathIndex, useCategories, useTransactions } from "@/lib/data";
import {
  availableMonths,
  byCategory,
  byDay,
  byMonth,
  detectRecurring,
  enrich,
  topMerchants,
  totals,
} from "@/lib/analytics";
import { money, monthLabel, shortMonthLabel, formatFullDate, monthKey } from "@/lib/format";
import { CATEGORY_PALETTE } from "@/lib/categories";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cashyou" },
      {
        name: "description",
        content: "See income, expenses, savings rate, category splits and recurring costs at a glance.",
      },
      { property: "og:title", content: "Dashboard — Cashyou" },
      { property: "og:description", content: "Your spending, summarised." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <DashboardPage />
    </AppShell>
  ),
});

function DashboardPage() {
  const navigate = useNavigate();
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const [month, setMonth] = useState("all");
  const [type, setType] = useState("all");

  const all = useMemo(
    () => enrich(transactions, buildPathIndex(categories).byId),
    [transactions, categories],
  );
  const months = useMemo(() => availableMonths(all), [all]);

  const filtered = useMemo(
    () =>
      all.filter(
        (t) =>
          (month === "all" || monthKey(t.txn_date) === month) &&
          (type === "all" || t.txn_type === type),
      ),
    [all, month, type],
  );

  const t = totals(filtered);
  const categorySplit = byCategory(filtered);
  const monthly = byMonth(all);
  const daily = byDay(filtered);
  const merchants = topMerchants(filtered);
  const recurring = detectRecurring(all).slice(0, 6);
  const recurringMonthly = recurring.reduce((sum, r) => sum + r.monthlyEstimate, 0);

  if (!isLoading && transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
          <Wallet className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No transactions yet. Upload a statement to see your dashboard.
          </p>
          <Button onClick={() => navigate({ to: "/" })}>Upload a statement</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {month === "all" ? "All time" : monthLabel(month)} · {filtered.length} transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40">
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
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36">
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total income" value={money(t.income)} tone="income" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Total expenses" value={money(t.expenses)} tone="expense" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard
          label="Net cash flow"
          value={money(t.net)}
          tone={t.net >= 0 ? "income" : "expense"}
          hint={t.net >= 0 ? "You saved money" : "You spent more than you earned"}
        />
        <StatCard
          label="Savings rate"
          value={`${t.savingsRate.toFixed(1)}%`}
          hint={`Transfers: ${money(t.transfers)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by category</CardTitle>
            <CardDescription>Click a slice to see those transactions</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {categorySplit.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySplit}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="80%"
                    paddingAngle={2}
                    onClick={(slice: { name?: string }, index?: number) => {
                      const name =
                        slice?.name ??
                        (typeof index === "number" ? categorySplit[index]?.name : undefined);
                      if (name) navigate({ to: "/transactions", search: { group: name, month } });
                    }}
                  >
                    {categorySplit.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}
                        className="cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs expenses</CardTitle>
            <CardDescription>Month by month, across all imports</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {monthly.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={shortMonthLabel} fontSize={12} />
                  <YAxis tickFormatter={(v: number) => money(v)} fontSize={12} width={70} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={monthLabel} />
                  <Bar dataKey="income" name="Income" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Legend iconType="circle" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily spending trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {daily.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tickFormatter={(v: number) => money(v)} fontSize={12} width={70} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={formatFullDate} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Spent"
                    stroke="var(--chart-1)"
                    fill="url(#spendFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {merchants.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-3">
                {merchants.map((m) => (
                  <li key={m.name}>
                    <button
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() =>
                        navigate({ to: "/transactions", search: { q: m.name, month } })
                      }
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        <span className="mt-1 block h-1.5 rounded-full bg-secondary">
                          <span
                            className="block h-1.5 rounded-full bg-primary"
                            style={{ width: `${(m.value / merchants[0]!.value) * 100}%` }}
                          />
                        </span>
                      </span>
                      <span className="num shrink-0 text-sm font-medium">{money(m.value)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="h-4 w-4" /> Recurring expenses
          </CardTitle>
          <CardDescription>
            Estimated {money(recurringMonthly)} per month across {recurring.length} subscriptions and
            bills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing repeating yet — import a few months of statements to spot subscriptions.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Merchant</th>
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium">Cadence</th>
                    <th className="py-2 font-medium">Last seen</th>
                    <th className="py-2 text-right font-medium">Typical</th>
                    <th className="py-2 text-right font-medium">Per month</th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((r) => (
                    <tr key={r.merchant} className="border-t">
                      <td className="py-2.5 font-medium">{r.merchant}</td>
                      <td className="py-2.5 text-muted-foreground">{r.category}</td>
                      <td className="py-2.5 capitalize text-muted-foreground">{r.cadence}</td>
                      <td className="num py-2.5 text-muted-foreground">{formatFullDate(r.lastDate)}</td>
                      <td className="num py-2.5 text-right">{money(r.averageAmount)}</td>
                      <td className="num py-2.5 text-right font-medium">{money(r.monthlyEstimate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Not enough data yet
    </div>
  );
}
