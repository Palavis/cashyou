export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const inrExact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number, exact = false) {
  return (exact ? inrExact : inr).format(Math.abs(value));
}

export function signedMoney(value: number, type: string) {
  const sign = type === "income" ? "+" : type === "expense" ? "−" : "";
  return `${sign}${money(value)}`;
}

export function formatDate(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", yyyy: undefined } as never);
}

export function formatFullDate(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function monthLabel(key: string) {
  const [y = 1970, m = 1] = key.split("-").map(Number) as number[];
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function shortMonthLabel(key: string) {
  const [y = 1970, m = 1] = key.split("-").map(Number) as number[];
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

/** Never show a full account number. Keeps only the last 4 digits. */
export function maskAccount(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return "••••" + digits.slice(-4);
}
