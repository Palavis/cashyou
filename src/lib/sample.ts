/**
 * Sample statements used to demo the full import flow without a real bank file.
 * They are generated as genuine CSV / spreadsheet-shaped text and pushed
 * through exactly the same parser as a real upload.
 */

interface Seed {
  day: number;
  narration: string;
  amount: number;
  kind: "D" | "C";
}

const MONTHLY: Seed[] = [
  { day: 1, narration: "SALARY CREDIT ACME TECHNOLOGIES PVT LTD", amount: 145000, kind: "C" },
  { day: 2, narration: "NEFT-DR-HOUSING RENT-LANDLORD S KUMAR", amount: 32000, kind: "D" },
  { day: 3, narration: "UPI/SWIGGY*8821/PAYMENT/OKICICI", amount: 486, kind: "D" },
  { day: 4, narration: "POS 4023XXXXXX1122 DMART BENGALURU", amount: 3240, kind: "D" },
  { day: 5, narration: "ACH DR NETFLIX ENTERTAINMENT SERVICES", amount: 649, kind: "D" },
  { day: 6, narration: "UPI/UBER INDIA SYSTEMS/1122334455", amount: 268, kind: "D" },
  { day: 7, narration: "BIL/BPAY/BESCOM ELECTRICITY/JUL", amount: 2180, kind: "D" },
  { day: 8, narration: "UPI/ZOMATO LIMITED/9911223/OKAXIS", amount: 712, kind: "D" },
  { day: 9, narration: "SI SIP HDFC AMC MUTUAL FUND", amount: 15000, kind: "D" },
  { day: 10, narration: "UPI/AMAZON PAY INDIA/ORD7781", amount: 2499, kind: "D" },
  { day: 11, narration: "POS INDIAN OIL FUEL STATION KORAMANGALA", amount: 2000, kind: "D" },
  { day: 12, narration: "UPI/AIRTEL PREPAID RECHARGE/9988", amount: 399, kind: "D" },
  { day: 13, narration: "ATM WDL NWD 4023XXXXXX1122 HSR LAYOUT", amount: 5000, kind: "D" },
  { day: 14, narration: "UPI/BLUE TOKAI COFFEE ROASTERS", amount: 430, kind: "D" },
  { day: 15, narration: "IMPS-CREDIT CARD PAYMENT HDFC CC AUTOPAY", amount: 18400, kind: "D" },
  { day: 16, narration: "UPI/OLA CABS ANI TECHNOLOGIES", amount: 340, kind: "D" },
  { day: 17, narration: "POS APOLLO PHARMACY BENGALURU", amount: 890, kind: "D" },
  { day: 18, narration: "UPI/BLINKIT GROCERY/778812", amount: 1180, kind: "D" },
  { day: 19, narration: "ACT FIBERNET BROADBAND BILLPAY", amount: 1299, kind: "D" },
  { day: 20, narration: "UPI/CULT FIT FITNESS/MEMBERSHIP", amount: 1500, kind: "D" },
  { day: 21, narration: "UPI/SWIGGY INSTAMART/44221", amount: 940, kind: "D" },
  { day: 22, narration: "POS MYNTRA DESIGNS FASHION", amount: 3180, kind: "D" },
  { day: 23, narration: "BOOKMYSHOW PVR CINEMAS ONLINE", amount: 760, kind: "D" },
  { day: 24, narration: "UPI/MOTHER DAIRY LOCAL KIRANA/PAY", amount: 620, kind: "D" },
  { day: 25, narration: "LIC INSURANCE PREMIUM AUTO DEBIT", amount: 2400, kind: "D" },
  { day: 26, narration: "UPI/ZEPTO MARKETPLACE/PAYMENT", amount: 830, kind: "D" },
  { day: 27, narration: "INT PD SAVINGS ACCOUNT INTEREST", amount: 320, kind: "C" },
  { day: 28, narration: "UPI/RAPIDO BIKE TAXI", amount: 96, kind: "D" },
  { day: 28, narration: "AMB CHARGES SMS CHARGE GST", amount: 118, kind: "D" },
];

const OCCASIONAL: Seed[] = [
  { day: 12, narration: "UPI/INDIGO AIRLINES BOOKING/6E442", amount: 8460, kind: "D" },
  { day: 17, narration: "NEFT CR FREELANCE INVOICE STUDIO NORTH", amount: 24000, kind: "C" },
  { day: 21, narration: "POS CROMA ELECTRONICS BENGALURU", amount: 6499, kind: "D" },
  { day: 9, narration: "UPI/AMAZON REFUND REVERSAL/ORD5521", amount: 1299, kind: "C" },
  { day: 23, narration: "UPI/IKEA HOME FURNISHING", amount: 4300, kind: "D" },
  { day: 6, narration: "UPI/PHARMEASY MEDICINES ORDER", amount: 1450, kind: "C" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** A six-month HDFC-style CSV statement (debit / credit / balance columns). */
export function sampleCsv(months = 6): string {
  const lines: string[] = [];
  lines.push("Statement of Account");
  lines.push("Account Number:,XXXXXXXX4417");
  lines.push("Account Holder:,Sample User");
  lines.push("");
  lines.push("Date,Narration,Chq/Ref No,Withdrawal Amt,Deposit Amt,Closing Balance");

  const today = new Date();
  let balance = 62000;
  for (let back = months - 1; back >= 0; back--) {
    const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const seeds = [...MONTHLY];
    if (back % 2 === 0) seeds.push(OCCASIONAL[back % OCCASIONAL.length]!);
    if (back === 0) seeds.push(OCCASIONAL[(back + 3) % OCCASIONAL.length]!);

    for (const seed of seeds.sort((a, b) => a.day - b.day)) {
      const day = Math.min(seed.day, lastDay);
      if (back === 0 && day > today.getDate()) continue;
      const jitter = seed.amount > 5000 ? 1 : 0.85 + ((day * 7 + back * 13) % 30) / 100;
      const amount = Math.round(seed.amount * jitter);
      balance += seed.kind === "C" ? amount : -amount;
      lines.push(
        [
          `${pad(day)}/${pad(month)}/${year}`,
          `"${seed.narration}"`,
          `REF${year}${pad(month)}${pad(day)}${Math.floor(amount)}`,
          seed.kind === "D" ? amount.toFixed(2) : "",
          seed.kind === "C" ? amount.toFixed(2) : "",
          balance.toFixed(2),
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

/** A second, deliberately different layout (single amount column + Dr/Cr flag). */
export function sampleAltCsv(): string {
  const lines = [
    "Txn Date;Transaction Details;Amount;Dr/Cr;Balance",
  ];
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), 1);
  let balance = 21000;
  const seeds = MONTHLY.slice(0, 14);
  for (const seed of seeds) {
    const day = Math.min(seed.day, today.getDate() || 1);
    balance += seed.kind === "C" ? seed.amount : -seed.amount;
    lines.push(
      [
        `${pad(day)}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()}`,
        seed.narration.replace(/;/g, " "),
        seed.amount.toFixed(2),
        seed.kind === "C" ? "CR" : "DR",
        balance.toFixed(2),
      ].join(";"),
    );
  }
  return lines.join("\n");
}

export function sampleFile(kind: "primary" | "alt" = "primary"): File {
  const text = kind === "primary" ? sampleCsv() : sampleAltCsv();
  const name = kind === "primary" ? "sample-statement-6-months.csv" : "sample-statement-alt-format.csv";
  return new File([text], name, { type: "text/csv" });
}
