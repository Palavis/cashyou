import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CATEGORIES, UNCATEGORIZED_PATH } from "./categories";
import type { TxnType } from "./merchants";

export interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  kind: string;
  sort_order: number;
  is_default: boolean;
}

export interface TransactionRow {
  id: string;
  txn_date: string;
  description: string;
  merchant: string;
  amount: number;
  txn_type: TxnType;
  category_id: string | null;
  source_statement_id: string | null;
  confidence: number;
  excluded: boolean;
  created_at: string;
}

export interface MerchantRuleRow {
  id: string;
  merchant_key: string;
  category_id: string | null;
  txn_type: string | null;
}

export interface StatementRow {
  id: string;
  file_name: string;
  file_type: string;
  bank_guess: string | null;
  transaction_count: number;
  account_mask: string | null;
  imported_at: string;
}

/* ------------------------------------------------------------- session */

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

/* ---------------------------------------------------------- categories */

export function categoryPath(cat: CategoryRow, all: CategoryRow[]): string {
  if (!cat.parent_id) return cat.name;
  const parent = all.find((c) => c.id === cat.parent_id);
  return parent ? `${parent.name} > ${cat.name}` : cat.name;
}

export function buildPathIndex(all: CategoryRow[]) {
  const byId = new Map<string, string>();
  const byPath = new Map<string, string>();
  for (const cat of all) {
    if (!cat.parent_id) continue;
    const path = categoryPath(cat, all);
    byId.set(cat.id, path);
    byPath.set(path, cat.id);
  }
  return { byId, byPath };
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,parent_id,kind,sort_order,is_default")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}

/** Seeds the default category tree the first time an account is used. */
export async function ensureDefaultCategories(userId: string) {
  const { count, error } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  let order = 0;
  for (const group of DEFAULT_CATEGORIES) {
    const { data: parent, error: parentError } = await supabase
      .from("categories")
      .insert({
        user_id: userId,
        name: group.name,
        kind: group.kind,
        sort_order: order++,
        is_default: true,
      })
      .select("id")
      .single();
    if (parentError) throw parentError;
    const children = group.children.map((name) => ({
      user_id: userId,
      name,
      parent_id: parent!.id,
      kind: group.kind,
      sort_order: order++,
      is_default: true,
    }));
    const { error: childError } = await supabase.from("categories").insert(children);
    if (childError) throw childError;
  }
}

/* -------------------------------------------------------- transactions */

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async (): Promise<TransactionRow[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id,txn_date,description,merchant,amount,txn_type,category_id,source_statement_id,confidence,excluded,created_at",
        )
        .order("txn_date", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount), confidence: Number(t.confidence) })) as TransactionRow[];
    },
  });
}

export function useMerchantRules() {
  return useQuery({
    queryKey: ["merchant_rules"],
    queryFn: async (): Promise<MerchantRuleRow[]> => {
      const { data, error } = await supabase
        .from("merchant_rules")
        .select("id,merchant_key,category_id,txn_type");
      if (error) throw error;
      return (data ?? []) as MerchantRuleRow[];
    },
  });
}

export function useStatements() {
  return useQuery({
    queryKey: ["statements"],
    queryFn: async (): Promise<StatementRow[]> => {
      const { data, error } = await supabase
        .from("statements")
        .select("id,file_name,file_type,bank_guess,transaction_count,account_mask,imported_at")
        .order("imported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StatementRow[];
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TransactionRow> }) => {
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

/* ------------------------------------------------------- merchant rule */

export async function saveMerchantRule(
  userId: string,
  merchantKey: string,
  categoryId: string | null,
  txnType: TxnType,
) {
  const { error } = await supabase
    .from("merchant_rules")
    .upsert(
      { user_id: userId, merchant_key: merchantKey, category_id: categoryId, txn_type: txnType },
      { onConflict: "user_id,merchant_key" },
    );
  if (error) throw error;
}

/* -------------------------------------------------------------- import */

export interface ImportPayload {
  userId: string;
  fileName: string;
  fileType: string;
  bankGuess?: string | undefined;
  accountMask?: string | undefined;
  rows: {
    date: string;
    description: string;
    merchant: string;
    amount: number;
    type: TxnType;
    categoryPath: string;
    confidence: number;
    remember?: boolean;
    merchantKey: string;
  }[];
}

export async function importStatement(payload: ImportPayload, categories: CategoryRow[]) {
  const { byPath } = buildPathIndex(categories);
  const fallback = byPath.get(UNCATEGORIZED_PATH) ?? null;

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .insert({
      user_id: payload.userId,
      file_name: payload.fileName,
      file_type: payload.fileType,
      bank_guess: payload.bankGuess ?? null,
      account_mask: payload.accountMask ?? null,
      transaction_count: payload.rows.length,
    })
    .select("id")
    .single();
  if (statementError) throw statementError;

  const rows = payload.rows.map((r) => ({
    user_id: payload.userId,
    txn_date: r.date,
    description: r.description,
    merchant: r.merchant,
    amount: r.amount,
    txn_type: r.type,
    category_id: byPath.get(r.categoryPath) ?? fallback,
    source_statement_id: statement!.id,
    confidence: r.confidence,
  }));

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("transactions").insert(rows.slice(i, i + 200));
    if (error) throw error;
  }

  const remembered = payload.rows.filter((r) => r.remember);
  const seen = new Set<string>();
  for (const r of remembered) {
    if (seen.has(r.merchantKey)) continue;
    seen.add(r.merchantKey);
    await saveMerchantRule(payload.userId, r.merchantKey, byPath.get(r.categoryPath) ?? fallback, r.type);
  }

  return { statementId: statement!.id, count: rows.length };
}

/* ---------------------------------------------------------- danger zone */

export async function deleteAllData() {
  const tables = ["transactions", "merchant_rules", "statements"] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) throw error;
  }
}

export async function resetCategories(userId: string) {
  const { error } = await supabase.from("categories").delete().not("id", "is", null);
  if (error) throw error;
  await ensureDefaultCategories(userId);
}
