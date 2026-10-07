import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteAllData,
  resetCategories,
  useSession,
  useStatements,
  useTransactions,
} from "@/lib/data";
import { formatFullDate } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Cashyou" },
      {
        name: "description",
        content: "Review how your data is handled, reset categories or delete everything you stored.",
      },
      { property: "og:title", content: "Settings — Cashyou" },
      { property: "og:description", content: "Privacy controls and data deletion for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ),
});

function SettingsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: transactions = [] } = useTransactions();
  const { data: statements = [] } = useStatements();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function wipe() {
    if (confirm !== "DELETE") {
      toast.error('Type DELETE to confirm.');
      return;
    }
    setBusy(true);
    try {
      await deleteAllData();
      await qc.invalidateQueries();
      setConfirm("");
      toast.success("All of your transactions, rules and import history were deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Privacy
            </CardTitle>
            <CardDescription>How Cashyou treats your financial data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>· Statement files are read in your browser and never uploaded or kept.</p>
            <p>· Only extracted transaction details are stored — no balances, no file contents.</p>
            <p>· Account numbers are masked to the last four digits everywhere they appear.</p>
            <p>· Your data is readable only by your account, enforced by the database itself.</p>
            <p>· Nothing is shared with anyone, and no statement content is logged.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your data</CardTitle>
            <CardDescription>
              {transactions.length} transactions from {statements.length} imports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {statements.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.file_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatFullDate(s.imported_at.slice(0, 10))}
                        {s.account_mask ? ` · account ${s.account_mask}` : ""}
                      </span>
                    </span>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {s.transaction_count} txns
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="outline"
              disabled={busy || !user}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await resetCategories(user.id);
                  await qc.invalidateQueries();
                  toast.success("Categories reset to the defaults");
                } catch {
                  toast.error("Couldn't reset categories while transactions still use them.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset categories to defaults
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Delete all my data</CardTitle>
          <CardDescription>
            Permanently removes every transaction, merchant rule and import record from your account.
            This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="confirm">Type DELETE to confirm</Label>
            <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={wipe} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Delete everything
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
