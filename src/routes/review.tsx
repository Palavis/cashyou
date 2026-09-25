import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  EyeOff,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { CategorySelect } from "@/components/category-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importStatement, useCategories, useSession } from "@/lib/data";
import { importStore, useStagedImport, type StagedTxn } from "@/lib/import-store";
import { money, formatFullDate } from "@/lib/format";
import type { TxnType } from "@/lib/merchants";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review import — SpendWise" },
      {
        name: "description",
        content: "Check and correct auto-categorized transactions before adding them to SpendWise.",
      },
      { property: "og:title", content: "Review import — SpendWise" },
      { property: "og:description", content: "Check categories before importing your transactions." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <ReviewPage />
    </AppShell>
  ),
});

const LOW_CONFIDENCE = 0.5;

function ReviewPage() {
  const staged = useStagedImport();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: categories = [] } = useCategories();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);
  const [splitting, setSplitting] = useState<StagedTxn | null>(null);
  const [splitAmount, setSplitAmount] = useState("");
  const [importing, setImporting] = useState(false);

  const rows = staged?.rows ?? [];
  const active = rows.filter((r) => !r.excluded);

  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let transfers = 0;
    let review = 0;
    for (const r of active) {
      if (r.txnTypeIsIncome?.()) void 0;
      if (r.type === "income") income += r.amount;
      else if (r.type === "expense") expenses += r.amount;
      else transfers += r.amount;
      if (r.confidence < LOW_CONFIDENCE) review++;
    }
    return { income, expenses, transfers, review, count: active.length };
  }, [active]);

  if (!staged) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing to review. Upload a statement to get started.
          </p>
          <Button onClick={() => navigate({ to: "/" })}>Upload a statement</Button>
        </CardContent>
      </Card>
    );
  }

  const visible = onlyReview ? rows.filter((r) => r.confidence < LOW_CONFIDENCE) : rows;

  function patch(id: string, changes: Partial<StagedTxn>) {
    importStore.updateRows((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulk(path: string) {
    importStore.updateRows((list) =>
      list.map((r) =>
        selected.has(r.id) ? { ...r, categoryPath: path, confidence: 1, source: "manual" } : r,
      ),
    );
    toast.success(`Updated ${selected.size} transactions`);
    setSelected(new Set());
    setBulkCategory("");
  }

  function doSplit() {
    if (!splitting) return;
    const part = Number(splitAmount);
    if (!Number.isFinite(part) || part <= 0 || part >= splitting.amount) {
      toast.error("Enter an amount smaller than the original.");
      return;
    }
    importStore.updateRows((list) => {
      const idx = list.findIndex((r) => r.id === splitting.id);
      if (idx < 0) return list;
      const original = list[idx];
      const first = { ...original, amount: original.amount - part };
      const second: StagedTxn = {
        ...original,
        id: `${original.id}-split-${Date.now()}`,
        amount: part,
        description: `${original.description} (split)`,
        source: "manual",
        confidence: 1,
      };
      return [...list.slice(0, idx), first, second, ...list.slice(idx + 1)];
    });
    setSplitting(null);
    setSplitAmount("");
    toast.success("Transaction split");
  }

  async function runImport() {
    if (!user) return;
    setImporting(true);
    try {
      const result = await importStatement(
        {
          userId: user.id,
          fileName: staged!.fileName,
          fileType: staged!.fileType,
          bankGuess: staged!.bankGuess,
          accountMask: staged!.accountMask,
          rows: active.map((r) => ({
            date: r.date,
            description: r.description,
            merchant: r.merchant,
            amount: r.amount,
            type: r.type,
            categoryPath: r.categoryPath,
            confidence: r.confidence,
            remember: r.remember,
            merchantKey: r.merchantKey,
          })),
        },
        categories,
      );
      importStore.clear();
      await queryClient.invalidateQueries();
      toast.success(`Imported ${result.count} transactions`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From <span className="font-medium text-foreground">{staged.fileName}</span>
            {staged.bankGuess ? ` · ${staged.bankGuess}` : ""}
            {staged.accountMask ? ` · account ${staged.accountMask}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              importStore.clear();
              navigate({ to: "/" });
            }}
          >
            Discard
          </Button>
          <Button onClick={runImport} disabled={importing || summary.count === 0}>
            <Check className="h-4 w-4" />
            {importing ? "Importing…" : `Import ${summary.count} transactions`}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Transactions" value={String(summary.count)} />
        <StatCard label="Income" value={money(summary.income)} tone="income" />
        <StatCard label="Expenses" value={money(summary.expenses)} tone="expense" />
        <StatCard label="Transfers" value={money(summary.transfers)} tone="transfer" />
        <StatCard
          label="Needs review"
          value={String(summary.review)}
          hint={summary.review ? "Low confidence matches" : "All confidently matched"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {selected.size > 0 ? `${selected.size} selected` : "All transactions"}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={onlyReview ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyReview((v) => !v)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs review
            </Button>
            {selected.size > 0 ? (
              <div className="w-56">
                <CategorySelect
                  categories={categories}
                  value={bulkCategory}
                  onChange={applyBulk}
                  className="h-9"
                />
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-y bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={selected.size > 0 && selected.size === visible.length}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? new Set(visible.map((r) => r.id)) : new Set())
                      }
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Merchant / Description</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b align-top last:border-0",
                      row.excluded && "opacity-40",
                      row.confidence < LOW_CONFIDENCE && "bg-warning/5",
                    )}
                  >
                    <td className="px-3 py-3">
                      <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} />
                    </td>
                    <td className="num whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {formatFullDate(row.date)}
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        value={row.merchant}
                        onChange={(e) => patch(row.id, { merchant: e.target.value })}
                        className="h-8 w-48 text-sm"
                      />
                      <p className="mt-1 max-w-sm truncate text-xs text-muted-foreground">
                        {row.description}
                      </p>
                      <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={row.remember}
                          onCheckedChange={(v) => patch(row.id, { remember: Boolean(v) })}
                        />
                        Remember this merchant
                      </label>
                    </td>
                    <td
                      className={cn(
                        "num whitespace-nowrap px-3 py-3 text-right font-medium",
                        row.type === "income" ? "text-income" : row.type === "expense" ? "text-expense" : "text-transfer",
                      )}
                    >
                      {money(row.amount, true)}
                    </td>
                    <td className="px-3 py-3">
                      <Select
                        value={row.type}
                        onValueChange={(v) => patch(row.id, { type: v as TxnType })}
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
                        value={row.categoryPath}
                        onChange={(path) =>
                          patch(row.id, { categoryPath: path, confidence: 1, source: "manual" })
                        }
                        className="h-8 w-52 text-xs"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <ConfidenceBadge value={row.confidence} source={row.source} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Split transaction"
                          onClick={() => {
                            setSplitting(row);
                            setSplitAmount("");
                          }}
                        >
                          <Scissors className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={row.excluded ? "Include" : "Exclude"}
                          onClick={() => patch(row.id, { excluded: !row.excluded })}
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Remove row"
                          onClick={() =>
                            importStore.updateRows((list) => list.filter((r) => r.id !== row.id))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(splitting)} onOpenChange={(open) => !open && setSplitting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split transaction</DialogTitle>
            <DialogDescription>
              {splitting ? `${splitting.merchant} · ${money(splitting.amount, true)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="split">Amount to move to a new row</Label>
            <Input
              id="split"
              inputMode="decimal"
              value={splitAmount}
              onChange={(e) => setSplitAmount(e.target.value)}
              placeholder="e.g. 500"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSplitting(null)}>
              Cancel
            </Button>
            <Button onClick={doSplit}>
              <Wand2 className="h-4 w-4" />
              Split
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ConfidenceBadge({ value, source }: { value: number; source: string }) {
  if (source === "manual" || source === "user-rule") {
    return <Badge variant="secondary">{source === "manual" ? "Edited" : "Your rule"}</Badge>;
  }
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.8 ? "bg-income/10 text-income" : value >= 0.5 ? "bg-warning/10 text-warning" : "bg-expense/10 text-expense";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", tone)}>
      Auto · {pct}%
    </span>
  );
}
