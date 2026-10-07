import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  buildTransactions,
  detectMapping,
  EMPTY_MAPPING,
  PdfPasswordError,
  readStatementFile,
  type ColumnMapping,
  type RawTable,
} from "@/lib/parse";
import { categorize, merchantLabel, type TxnType } from "@/lib/merchants";
import { buildPathIndex, useCategories, useMerchantRules, useStatements } from "@/lib/data";
import { importStore } from "@/lib/import-store";
import { sampleFile } from "@/lib/sample";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upload statement — Cashyou" },
      {
        name: "description",
        content:
          "Drop a CSV, XLSX or PDF bank statement and Cashyou turns it into categorized transactions — processed in your browser, never stored.",
      },
      { property: "og:title", content: "Upload statement — Cashyou" },
      {
        property: "og:description",
        content: "Turn a bank statement into categorized spending insights, privately.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <UploadPage />
    </AppShell>
  ),
});

const FIELDS: { key: keyof ColumnMapping; label: string; hint: string }[] = [
  { key: "date", label: "Date", hint: "required" },
  { key: "description", label: "Description / Narration", hint: "required" },
  { key: "debit", label: "Debit / Withdrawal", hint: "optional" },
  { key: "credit", label: "Credit / Deposit", hint: "optional" },
  { key: "amount", label: "Amount", hint: "if no debit/credit split" },
  { key: "type", label: "Transaction type (Dr/Cr)", hint: "optional" },
  { key: "balance", label: "Balance", hint: "ignored" },
];

function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: File; table: RawTable } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [passwordFile, setPasswordFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [passwordIncorrect, setPasswordIncorrect] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: rules = [] } = useMerchantRules();
  const { data: statements = [] } = useStatements();

  const userRules = (() => {
    const { byId } = buildPathIndex(categories);
    const map: Record<string, { categoryPath: string; type?: TxnType }> = {};
    for (const rule of rules) {
      const path = rule.category_id ? byId.get(rule.category_id) : undefined;
      if (path) map[rule.merchant_key] = { categoryPath: path, type: (rule.txn_type as TxnType) ?? undefined };
    }
    return map;
  })();

  function stage(file: File, table: RawTable, mappingToUse: ColumnMapping) {
    const parsed = buildTransactions(table, mappingToUse);
    if (parsed.length === 0) {
      toast.error("No transactions could be read. Try mapping the columns manually.");
      return false;
    }
    const rows = parsed.map((t, i) => {
      const result = categorize(t.description, userRules);
      return {
        id: `${i}`,
        date: t.date,
        description: t.description,
        merchantKey: result.merchantKey,
        merchant: result.label ?? merchantLabel(result.merchantKey),
        amount: t.amount,
        type: result.type ?? t.type,
        categoryPath: result.categoryPath,
        confidence: result.confidence,
        source: result.source,
        excluded: false,
        remember: false,
      };
    });
    importStore.set({
      fileName: file.name,
      fileType: table.fileType,
      bankGuess: table.bankGuess,
      accountMask: table.accountMask,
      table,
      mapping: mappingToUse,
      rows,
    });
    return true;
  }

  async function handleFile(file: File, password?: string) {
    setBusy(true);
    setPending(null);
    try {
      const table = await readStatementFile(file, password);
      setPasswordFile(null);
      setPdfPassword("");
      setPasswordIncorrect(false);
      const { mapping: detected, confident } = detectMapping(table.headers);
      if (!confident) {
        setPending({ file, table });
        setMapping(detected);
        toast.message("We couldn't confidently detect the columns — please map them below.");
        return;
      }
      if (stage(file, table, detected)) navigate({ to: "/review" });
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        setPasswordFile(file);
        setPdfPassword("");
        setPasswordIncorrect(err.incorrect);
      } else {
        toast.error(err instanceof Error ? err.message : "Could not read that file");
      }
    } finally {
      setBusy(false);
      // The File object goes out of scope here; nothing is uploaded or persisted.
    }
  }

  return (
    <div className="space-y-6">
      <Dialog
        open={passwordFile !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPasswordFile(null);
            setPdfPassword("");
            setPasswordIncorrect(false);
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (passwordFile && pdfPassword.length > 0) {
                void handleFile(passwordFile, pdfPassword);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Password-protected PDF</DialogTitle>
              <DialogDescription>
                Enter the password provided by your bank to read this statement. It is used only in
                your browser and is not saved.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="statement-password">PDF password</Label>
              <Input
                id="statement-password"
                type="password"
                autoComplete="off"
                autoFocus
                value={pdfPassword}
                onChange={(event) => setPdfPassword(event.target.value)}
                disabled={busy}
                aria-invalid={passwordIncorrect}
                aria-describedby={passwordIncorrect ? "statement-password-error" : undefined}
              />
              {passwordIncorrect ? (
                <p id="statement-password-error" className="text-sm text-destructive" role="alert">
                  That password didn’t work. Check it and try again.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setPasswordFile(null);
                  setPdfPassword("");
                  setPasswordIncorrect(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || pdfPassword.length === 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "Reading PDF…" : "Unlock PDF"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Upload a statement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV, XLSX or PDF. We read it here in your browser, pull out the transactions and throw the
          file away.
        </p>
      </div>

      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm text-muted-foreground">
            This file may contain sensitive financial information. Your statement is processed only
            to extract transactions. The original file is not retained after processing, and any
            account number found is masked to the last four digits.
          </p>
        </CardContent>
      </Card>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card px-6 py-14 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Upload className="h-5 w-5 text-primary" />
          )}
        </span>
        <p className="mt-4 text-base font-medium">
          {busy ? "Reading your statement…" : "Drag & drop your statement here"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">or choose a file from your device</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            Choose file
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void handleFile(sampleFile("primary"))}
          >
            <Sparkles className="h-4 w-4" />
            Try sample statement
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void handleFile(sampleFile("alt"))}>
            Sample in another bank format
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> CSV
          </span>
          <span className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF
          </span>
        </div>
      </div>

      {pending ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Map the columns</CardTitle>
            <CardDescription>
              This bank uses column names we don't recognise. Tell us which column is which — we
              found {pending.table.rows.length} data rows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {field.label} <span className="opacity-60">({field.hint})</span>
                  </label>
                  <Select
                    value={String(mapping[field.key])}
                    onValueChange={(v) => setMapping({ ...mapping, [field.key]: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not used" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">Not used</SelectItem>
                      {pending.table.headers.map((header, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-secondary text-left">
                  <tr>
                    {pending.table.headers.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.table.rows.slice(0, 4).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((cell, j) => (
                        <td key={j} className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (mapping.date < 0 || mapping.description < 0) {
                    toast.error("Date and description columns are required.");
                    return;
                  }
                  if (stage(pending.file, pending.table, mapping)) navigate({ to: "/review" });
                }}
              >
                Continue to review
              </Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How your data is handled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[
              "Statement files are parsed in your browser and never uploaded or stored.",
              "Only date, description, merchant, amount, type and category are saved.",
              "Account numbers are masked to the last four digits, balances are discarded.",
              "Everything is locked to your account by database-level access rules.",
              "You can delete all of your data at any time from Settings.",
            ].map((line) => (
              <p key={line} className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {line}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent imports</CardTitle>
            <CardDescription>Only the file name and a count — never the file itself.</CardDescription>
          </CardHeader>
          <CardContent>
            {statements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No statements imported yet.</p>
            ) : (
              <ul className="space-y-3">
                {statements.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFullDate(s.imported_at.slice(0, 10))}
                        {s.bank_guess ? ` · ${s.bank_guess}` : ""}
                        {s.account_mask ? ` · ${s.account_mask}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">{s.transaction_count} txns</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
