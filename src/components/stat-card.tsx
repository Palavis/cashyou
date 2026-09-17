import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "default" | "income" | "expense" | "transfer";
  icon?: ReactNode;
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <p
          className={cn(
            "num mt-2 text-2xl font-semibold",
            tone === "income" && "text-income",
            tone === "expense" && "text-expense",
            tone === "transfer" && "text-transfer",
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
