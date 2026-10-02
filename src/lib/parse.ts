import type { TxnType } from "./merchants";

export interface RawTable {
  headers: string[];
  rows: string[][];
  /** Masked account number if one was detected in the file (never the full number). */
  accountMask?: string | undefined;
  bankGuess?: string | undefined;
  fileType: "csv" | "xlsx" | "pdf";
}

export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  type: number;
  balance: number;
}

export const EMPTY_MAPPING: ColumnMapping = {
  date: -1,
  description: -1,
  amount: -1,
  debit: -1,
  credit: -1,
  type: -1,
  balance: -1,
};

export interface ParsedTxn {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // always positive
  type: TxnType;
}

/* ------------------------------------------------------------------ CSV */

export function parseDelimited(text: string): string[][] {
  const delimiter = pickDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  row.push(field.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows.filter((r) => r.some((c) => c !== ""));
}

function pickDelimiter(text: string) {
  const sample = text.slice(0, 4000);
  const counts: Record<string, number> = {
    ",": (sample.match(/,/g) || []).length,
    ";": (sample.match(/;/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
    "|": (sample.match(/\|/g) || []).length,
  };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : ",";
}

/** Bank statements often carry preamble rows before the real header row. */
function tableFromGrid(grid: string[][], fileType: RawTable["fileType"]): RawTable {
  let headerIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const score = headerScore(grid[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
  const headers = (grid[headerIndex] ?? []).map((h, i) => h || `Column ${i + 1}`);
  const rows = grid
    .slice(headerIndex + 1)
    .filter((r) => r.some((c) => c && c.trim() !== ""))
    .map((r) => {
      const copy = r.slice(0, headers.length);
      while (copy.length < headers.length) copy.push("");
      return copy;
    });
  return {
    headers,
    rows,
    fileType,
    accountMask: findAccountMask(grid.slice(0, headerIndex + 1).flat().join(" ")),
    bankGuess: guessBank(grid.slice(0, headerIndex + 1).flat().join(" ")),
  };
}

const HEADER_WORDS = [
  "date",
  "description",
  "narration",
  "particular",
  "details",
  "remarks",
  "debit",
  "credit",
  "withdrawal",
  "deposit",
  "amount",
  "balance",
  "type",
  "ref",
];

function headerScore(row: string[]) {
  const filled = row.filter((c) => c && c.trim()).length;
  if (filled < 2) return -1;
  let hits = 0;
  for (const cell of row) {
    const c = (cell || "").toLowerCase();
    if (HEADER_WORDS.some((w) => c.includes(w))) hits++;
  }
  return hits * 10 + filled;
}

/* ---------------------------------------------------------------- XLSX */

export async function readXlsx(file: File): Promise<RawTable> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""]!;
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown as string[][];
  return tableFromGrid(
    grid.map((r) => r.map((c) => String(c ?? "").trim())),
    "xlsx",
  );
}

export async function readCsv(file: File): Promise<RawTable> {
  const text = await file.text();
  return tableFromGrid(parseDelimited(text), "csv");
}

/* ----------------------------------------------------------------- PDF */

const DATE_START =
  /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s?[A-Za-z]{3,9}\s?[-,]?\s?\d{2,4}|\d{4}-\d{2}-\d{2})/;
const NUMBER_TOKEN = /-?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?(?:\s?(?:Dr|Cr|DR|CR))?/g;

/**
 * Extracts text lines from a PDF and reconstructs statement rows.
 * Handles the common Indian bank layouts: separate debit/credit columns,
 * single amount column with a Dr/Cr suffix, and an optional running balance.
 */
export async function readPdf(file: File): Promise<RawTable> {
  const pdfjs = await import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byRow = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round((item.transform[5] ?? 0) / 3) * 3;
      const arr = byRow.get(y) ?? [];
      arr.push({ x: item.transform[4] ?? 0, s: item.str });
      byRow.set(y, arr);
    }
    const ys = [...byRow.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const line = byRow
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((i) => i.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
  }
  try {
    const d = doc as unknown as { destroy?: () => Promise<void>; cleanup?: () => Promise<void> };
    if (typeof d.destroy === "function") await d.destroy();
    else if (typeof d.cleanup === "function") await d.cleanup();
  } catch {
    /* cleanup is best-effort */
  }

  const head = lines.slice(0, 20).join(" ");
  const rows: string[][] = [];
  for (const line of lines) {
    if (!DATE_START.test(line)) continue;
    const dateMatch = line.match(DATE_START)!;
    const rest = line.slice(dateMatch[0].length).trim();
    const numbers = rest.match(NUMBER_TOKEN) ?? [];
    if (numbers.length === 0) continue;
    const firstNumberAt = rest.indexOf(numbers[0] ?? "");
    const description = rest.slice(0, firstNumberAt).trim() || rest;

    let debit = "";
    let credit = "";
    let balance = "";
    const marked = numbers.filter((n) => /(Dr|Cr)$/i.test(n.trim()));
    if (marked.length > 0) {
      for (const n of marked) {
        if (/Cr$/i.test(n.trim())) credit = n;
        else debit = n;
      }
      const plain = numbers.filter((n) => !/(Dr|Cr)$/i.test(n.trim()));
      if (plain.length) balance = plain[plain.length - 1] ?? "";
    } else if (numbers.length >= 3) {
      // amount-ish, amount-ish, balance — one of the first two is blank in the
      // original layout, so treat the larger trailing one as balance.
      debit = numbers[numbers.length - 3] ?? "";
      credit = numbers[numbers.length - 2] ?? "";
      balance = numbers[numbers.length - 1] ?? "";
    } else if (numbers.length === 2) {
      debit = numbers[0] ?? "";
      balance = numbers[1] ?? "";
    } else {
      debit = numbers[0] ?? "";
    }

    rows.push([dateMatch[0], description, clean(debit), clean(credit), clean(balance)]);
  }

  return {
    headers: ["Date", "Description", "Debit", "Credit", "Balance"],
    rows,
    fileType: "pdf",
    accountMask: findAccountMask(head),
    bankGuess: guessBank(head),
  };
}

function clean(n: string) {
  return n.replace(/\s?(Dr|Cr|DR|CR)$/i, "").trim();
}

export async function readStatementFile(file: File): Promise<RawTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return readCsv(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return readXlsx(file);
  if (name.endsWith(".pdf")) return readPdf(file);
  throw new Error("Unsupported file. Please use a CSV, XLSX or PDF statement.");
}

/* -------------------------------------------------------- detect + map */

const PATTERNS: Record<keyof ColumnMapping, RegExp> = {
  date: /^(txn|transaction|value|posting|tran)?\s*[._-]?\s*date/i,
  description: /(description|narration|particular|details|remarks|transaction remarks|payee)/i,
  amount: /^(amount|amt|transaction amount|value)$/i,
  debit: /(debit|withdrawal|withdrawl|dr\b|paid out|money out)/i,
  credit: /(credit|deposit|cr\b|paid in|money in)/i,
  type: /(type|dr\/cr|cr\/dr|indicator|mode)/i,
  balance: /(balance|closing bal)/i,
};

export function detectMapping(headers: string[]): {
  mapping: ColumnMapping;
  confident: boolean;
} {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  (Object.keys(PATTERNS) as (keyof ColumnMapping)[]).forEach((key) => {
    const idx = headers.findIndex((h) => PATTERNS[key].test((h || "").trim()));
    mapping[key] = idx;
  });
  if (mapping.description < 0) {
    const idx = headers.findIndex((h) => /desc|narr|part|detail|remark/i.test(h || ""));
    if (idx >= 0) mapping.description = idx;
  }
  const hasMoney = mapping.amount >= 0 || mapping.debit >= 0 || mapping.credit >= 0;
  const confident = mapping.date >= 0 && mapping.description >= 0 && hasMoney;
  return { mapping, confident };
}

export function parseNumber(value: string): number | null {
  if (value == null) return null;
  const raw = String(value)
    .replace(/[₹$€\s]/g, "")
    .replace(/,/g, "")
    .replace(/\((.*)\)/, "-$1")
    .replace(/(Dr|Cr|DR|CR)$/i, "")
    .trim();
  if (!raw || raw === "-") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseDate(value: string): string | null {
  if (!value) return null;
  const raw = String(value).trim();

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (Number(m) > 12 && Number(d) <= 12) [d, m] = [m, d];
    const year = (y ?? "").length === 2 ? 2000 + Number(y) : Number(y);
    return build(year, Number(m), Number(d));
  }

  const dMon = raw.match(/^(\d{1,2})[\s-]?([A-Za-z]{3,9})[\s,-]*(\d{2,4})?/);
  if (dMon) {
    const m = MONTHS[(dMon[2] ?? "").slice(0, 3).toLowerCase()];
    if (m) {
      const y = dMon[3] ? (dMon[3].length === 2 ? 2000 + Number(dMon[3]) : Number(dMon[3])) : new Date().getFullYear();
      return build(y, m, Number(dMon[1]));
    }
  }

  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return d.toISOString().slice(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function build(y: number, m: number, d: number) {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function buildTransactions(table: RawTable, mapping: ColumnMapping): ParsedTxn[] {
  const out: ParsedTxn[] = [];
  for (const row of table.rows) {
    const date = parseDate(cell(row, mapping.date));
    if (!date) continue;
    const description = cell(row, mapping.description) || cell(row, mapping.type) || "Transaction";

    const debit = parseNumber(cell(row, mapping.debit));
    const credit = parseNumber(cell(row, mapping.credit));
    const amountRaw = parseNumber(cell(row, mapping.amount));
    const typeCell = cell(row, mapping.type).toUpperCase();

    let amount: number | null = null;
    let type: TxnType = "expense";

    if (debit && Math.abs(debit) > 0) {
      amount = Math.abs(debit);
      type = "expense";
    } else if (credit && Math.abs(credit) > 0) {
      amount = Math.abs(credit);
      type = "income";
    } else if (amountRaw != null) {
      amount = Math.abs(amountRaw);
      if (/\b(CR|CREDIT|DEPOSIT|IN)\b/.test(typeCell)) type = "income";
      else if (/\b(DR|DEBIT|WITHDRAWAL|OUT)\b/.test(typeCell)) type = "expense";
      else type = amountRaw >= 0 ? "income" : "expense";
    }

    if (amount == null || amount === 0) continue;
    out.push({ date, description: description.replace(/\s+/g, " ").trim(), amount, type });
  }
  return out;
}

function cell(row: string[], idx: number) {
  return idx >= 0 && idx < row.length ? String(row[idx] ?? "").trim() : "";
}

/* ------------------------------------------------------------- privacy */

export function findAccountMask(text: string): string | undefined {
  const match = text.match(/\b(?:\d[ -]?){9,18}\b/);
  if (!match) return undefined;
  const digits = match[0].replace(/\D/g, "");
  if (digits.length < 9) return undefined;
  return "••••" + digits.slice(-4);
}

const BANKS = [
  "HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra",
  "Yes Bank", "IDFC FIRST", "IndusInd", "Punjab National Bank", "Bank of Baroda",
  "Canara Bank", "Union Bank", "Federal Bank", "RBL Bank", "AU Small Finance",
];

export function guessBank(text: string): string | undefined {
  const upper = text.toUpperCase();
  return BANKS.find((b) => upper.includes(b.toUpperCase()));
}
