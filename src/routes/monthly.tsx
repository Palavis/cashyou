import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildPathIndex, useCategories, useTransactions } from "@/lib/data";
import { availableMonths, compareMonths, enrich } from "@/lib/analytics";
import { money, monthLabel } from "@/lib/format";
import { CATEGORY_PALETTE } from "@/lib/categories";

export const Route = createFileRoute("/monthly")({
  head: () => ({
    meta: [
      { title: "Monthly view — SpendWise" },
      {
        name: "description",
        content: "Compare this month's income, spending and category mix against the previous month.",
      },
      { property: "og:title", content: "Monthly view — SpendWise" },
      { property: "og:description", content: "Month-on-month spending comparison." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <MonthlyPage />
    </AppShell>
  ),
});

function previousMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthlyPage() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const all = useMemo(
    () => enrich(transactions, buildPathIndex(categories).byId),
    [transactions, categories],
  );
  const months = useMemo(() => availableMonths(all), [all]);
  const [month, setMonth] = useState<string | null>(null);
  const current = month ?? months[0];

  if (!current) {
    return (
      <Card>
        <CardContent className="py-20 text-center text-sm text-muted-foreground">
          Import a statement to see monthly breakdowns.
        </CardContent>
      </Card>
    );
  }

  const prev = previousMonth(current);
  const cmp = compareMonths(all, current, prev);
  const totalExpenses = cmp.categories.reduce((s, c) => s + c.value, 0);
  const savings = cmp.current.net;
  const savingsPct = cmp.current.income > 0 ? (savings / cmp.current.income) * 100 : 0;
  const spendDelta = cmp.current.expenses - cmp.previous.expenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Monthly view</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthLabel(current)} compared with {monthLabel(prev)}
          </p>
        </div>
        <Select value={current} onValueChange={setMonth}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={money(cmp.current.income)} tone="income" />
        <StatCard
          label="Expenses"
          value={money(cmp.current.expenses)}
          tone="expense"
          hint={
            cmp.previous.expenses > 0
              ? `${spendDelta >= 0 ? "Up" : "Down"} ${money(Math.abs(spendDelta))} vs last month`
              : "No previous month to compare"
          }
        />
        <StatCard label="Savings" value={money(savings)} tone={savings >= 0 ? "income" : "expense"} />
        <StatCard label="Savings rate" value={`${savingsPct.toFixed(1)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category breakdown</CardTitle>
            <CardDescription>Where {money(totalExpenses)} went this month</CardDescription>
          </CardHeader>
          <CardContent>
            {cmp.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending recorded this month.</p>
            ) : (
              <ul className="space-y-3">
                {cmp.categories.map((c, i) => (
                  <li key={c.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="num text-muted-foreground">
                        {money(c.value)} · {((c.value / totalExpenses) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="mt-1.5 block h-1.5 rounded-full bg-secondary">
                      <span
                        className="block h-1.5 rounded-full"
                        style={{
                          width: `${(c.value / cmp.categories[0].value) * 100}%`,
                          backgroundColor: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versus {monthLabel(prev)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row
              label="Income"
              current={cmp.current.income}
              previous={cmp.previous.income}
              goodWhenUp
            />
            <Row label="Expenses" current={cmp.current.expenses} previous={cmp.previous.expenses} />
            <Row label="Net cash flow" current={cmp.current.net} previous={cmp.previous.net} goodWhenUp />

            {cmp.biggestIncrease && cmp.biggestIncrease.delta > 0 ? (
              <p className="rounded-lg bg-expense/5 p-3 text-muted-foreground">
                Biggest increase: <span className="font-medium text-foreground">{cmp.biggestIncrease.name}</span>{" "}
                up {money(cmp.biggestIncrease.delta)}
              </p>
            ) : null}
            {cmp.biggestDecrease && cmp.biggestDecrease.delta < 0 ? (
              <p className="rounded-lg bg-income/5 p-3 text-muted-foreground">
                Biggest drop: <span className="font-medium text-foreground">{cmp.biggestDecrease.name}</span>{" "}
                down {money(Math.abs(cmp.biggestDecrease.delta))}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  current,
  previous,
  goodWhenUp = false,
}: {
  label: string;
  current: number;
  previous: number;
  goodWhenUp?: boolean;
}) {
  const delta = current - previous;
  const up = delta >= 0;
  const good = goodWhenUp ? up : !up;
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="num font-medium">{money(current)}</span>
        <span className={`num flex items-center gap-0.5 text-xs ${good ? "text-income" : "text-expense"}`}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {money(Math.abs(delta))}
        </span>
      </span>
    </div>
  );
}
