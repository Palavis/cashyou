import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { buildPathIndex, useCategories, useMerchantRules, useSession } from "@/lib/data";
import { merchantLabel } from "@/lib/merchants";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories — SpendWise" },
      {
        name: "description",
        content: "Rename, add or remove spending categories and manage remembered merchant rules.",
      },
      { property: "og:title", content: "Categories — SpendWise" },
      { property: "og:description", content: "Make the category list your own." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <CategoriesPage />
    </AppShell>
  ),
});

function CategoriesPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: rules = [] } = useMerchantRules();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const parents = categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const { byId } = buildPathIndex(categories);

  const refresh = () => qc.invalidateQueries();

  async function rename(id: string) {
    if (!draft.trim()) return;
    const { error } = await supabase.from("categories").update({ name: draft.trim() }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      setEditing(null);
      await refresh();
    }
  }

  async function addChild(parentId: string) {
    if (!user || !newName.trim()) return;
    const parent = categories.find((c) => c.id === parentId);
    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: newName.trim(),
      parent_id: parentId,
      kind: parent?.kind ?? "expense",
      sort_order: categories.length + 1,
      is_default: false,
    });
    if (error) toast.error(error.message);
    else {
      setNewName("");
      setAdding(null);
      await refresh();
    }
  }

  async function addGroup() {
    if (!user || !newGroup.trim()) return;
    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: newGroup.trim(),
      kind: "expense",
      sort_order: categories.length + 1,
      is_default: false,
    });
    if (error) toast.error(error.message);
    else {
      setNewGroup("");
      await refresh();
    }
  }

  async function removeCategory(id: string) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error("Couldn't delete — transactions may still use this category.");
    else {
      toast.success("Category deleted");
      await refresh();
    }
  }

  async function removeRule(id: string) {
    const { error } = await supabase.from("merchant_rules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rename anything, add your own, and manage the merchants you've taught SpendWise.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {parents.map((parent) => {
            const children = categories
              .filter((c) => c.parent_id === parent.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <Card key={parent.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  {editing === parent.id ? (
                    <div className="flex flex-1 gap-2">
                      <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8" />
                      <Button size="sm" onClick={() => rename(parent.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <CardTitle className="text-base">{parent.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(parent.id);
                            setDraft(parent.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeCategory(parent.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {children.map((child) =>
                    editing === child.id ? (
                      <span key={child.id} className="flex items-center gap-1">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="h-8 w-40"
                        />
                        <Button size="sm" onClick={() => rename(child.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    ) : (
                      <span
                        key={child.id}
                        className="group flex items-center gap-1 rounded-full border bg-secondary/60 py-1 pl-3 pr-1.5 text-sm"
                      >
                        {child.name}
                        <button
                          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                          aria-label={`Rename ${child.name}`}
                          onClick={() => {
                            setEditing(child.id);
                            setDraft(child.name);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${child.name}`}
                          onClick={() => removeCategory(child.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ),
                  )}

                  {adding === parent.id ? (
                    <span className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Subcategory"
                        className="h-8 w-40"
                        onKeyDown={(e) => e.key === "Enter" && addChild(parent.id)}
                      />
                      <Button size="sm" onClick={() => addChild(parent.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setAdding(parent.id);
                        setNewName("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardContent className="flex gap-2 p-4">
              <Input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="New top-level category"
                onKeyDown={(e) => e.key === "Enter" && addGroup()}
              />
              <Button onClick={addGroup}>
                <Plus className="h-4 w-4" /> Add group
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Remembered merchants</CardTitle>
            <CardDescription>
              These rules categorise matching transactions automatically in future imports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None yet. Tick "Remember this merchant" while reviewing an import, or change a
                category on the transactions page.
              </p>
            ) : (
              <ul className="space-y-2">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{merchantLabel(rule.merchant_key)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(rule.category_id && byId.get(rule.category_id)) || "Other > Uncategorized"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {rule.txn_type ? <Badge variant="secondary">{rule.txn_type}</Badge> : null}
                      <Button size="sm" variant="ghost" onClick={() => removeRule(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
