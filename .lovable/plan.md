# SpendWise — Private Personal Finance App

A private, single-user-per-account app: upload a bank statement, get categorized transactions, review and correct them, then explore spending insights.

## Architecture at a glance

**Frontend** — TanStack Start (React) with a finance-dashboard style design system: neutral surfaces, one restrained accent, cards + tables + simple charts (Recharts). Screens: Upload (drag-and-drop, primary screen), Review, Transactions, Dashboard, Monthly, Categories, Settings. Fully responsive.

**Backend** — Server functions only (no public endpoints). All parsing, categorization and writes happen server-side; the browser never sees keys.

**Database** — Lovable Cloud (Postgres). Tables: `transactions`, `categories`, `merchant_rules`, `statements` (metadata only: filename, bank guess, row count, imported_at — never file content). Row Level Security on every table, scoped to `auth.uid()`; explicit grants; no service-role key in client code.

**File processing** — File is parsed in-memory in a server function and discarded immediately; nothing is written to storage. CSV/XLSX via a header-mapping detector; PDF via text extraction tuned for common Indian bank layouts (Dr/Cr suffixes, separate debit/credit columns, ₹ and comma formats). When headers are ambiguous, a manual column-mapping step appears before parsing continues. Account numbers detected in the text are masked to the last 4 digits and never stored in full.

**Categorization engine** — Merchant normalization (strip `*12345`, `IN`, `PVT LTD`, UPI/IMPS prefixes) then rule matching against a built-in Indian merchant ruleset (Swiggy, Zomato, Uber, Ola, Netflix, Amazon, DMart…), plus the user's own saved merchant rules which always win. Each result carries a confidence score; low-confidence rows are highlighted for review. Correcting a category offers "Remember this merchant", which saves a personal rule.

**Authentication** — Email/password sign-in via Lovable Cloud. Every route with data is behind an auth gate; every query filters by the signed-in user through RLS.

**Security & privacy controls** — No secrets in frontend code; no statement retention; no logging of descriptions, balances or account numbers; masked account numbers in UI; pre-import sensitivity warning; "Delete all my data" in Settings that wipes transactions, rules and statement metadata.

## Data model

`transactions`: id, user_id, txn_date, description, merchant, amount, type (income/expense/transfer), category_id, subcategory, source_statement_id, confidence, excluded, created_at.

`categories`: id, user_id, name, parent_id — seeded with the full default tree (Food & Dining, Transport, Shopping, Bills & Utilities, Entertainment, Health, Finance, Income, Transfers, Other) and fully editable.

`merchant_rules`: id, user_id, merchant_key, category_id, subcategory.

## Build order

1. **Design system + full UI flow on mock data** — upload, review, dashboard, monthly view, categories, settings, search, recurring detection. Everything clickable and complete.
2. **CSV + XLSX import** — real parsing, header detection, manual column mapping fallback, import summary (count, income, expenses, transfers, needs-review).
3. **PDF import** — Indian bank statement layouts, debit/credit notation variants, account masking.
4. **Categorization engine** — normalization, rules, confidence, "remember this merchant".
5. **Persistence** — enable Lovable Cloud, auth, tables with RLS and grants, migrate the UI from mock data to live data, delete-all-data.

Explicitly out of scope: bank connections, auto-login, UPI integration, trading, payments, credit score, financial advice.

I'll report what's done and what remains after each stage.
