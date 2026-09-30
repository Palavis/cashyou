export type CategoryKind = "expense" | "income" | "transfer";

export interface DefaultCategory {
  name: string;
  kind: CategoryKind;
  children: string[];
}

/** The default category tree seeded for every new account. Fully editable afterwards. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Food & Dining",
    kind: "expense",
    children: ["Restaurants", "Food Delivery", "Cafes", "Groceries"],
  },
  {
    name: "Transport",
    kind: "expense",
    children: ["Uber/Ola", "Fuel", "Public Transport", "Parking", "Flights/Travel"],
  },
  {
    name: "Shopping",
    kind: "expense",
    children: ["Online Shopping", "Clothing", "Electronics", "Home"],
  },
  {
    name: "Bills & Utilities",
    kind: "expense",
    children: ["Electricity", "Mobile", "Internet", "Rent", "Other Bills"],
  },
  {
    name: "Entertainment",
    kind: "expense",
    children: ["Streaming", "Movies", "Games", "Events"],
  },
  { name: "Health", kind: "expense", children: ["Pharmacy", "Medical", "Fitness"] },
  {
    name: "Finance",
    kind: "expense",
    children: ["Investments", "Insurance", "Bank Charges", "Credit Card Payment", "Loan/EMI"],
  },
  {
    name: "Income",
    kind: "income",
    children: ["Salary", "Freelance", "Interest", "Refund", "Other Income"],
  },
  {
    name: "Transfers",
    kind: "transfer",
    children: [
      "Own Account Transfer",
      "Credit Card Payment",
      "Cash Withdrawal",
      "Other Transfer",
    ],
  },
  { name: "Other", kind: "expense", children: ["Uncategorized"] },
];

export const UNCATEGORIZED_PATH = "Other > Uncategorized";

export const CATEGORY_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];
