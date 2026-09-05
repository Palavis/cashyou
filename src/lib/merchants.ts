import { UNCATEGORIZED_PATH } from "./categories";

export type TxnType = "income" | "expense" | "transfer";

/** Strips payment-rail prefixes, reference numbers and legal suffixes from a raw
 *  statement narration so that "SWIGGY*12345", "UPI/SWIGGY IN/..." and
 *  "SWIGGY FOOD PVT LTD" all collapse to the same merchant key. */
export function normalizeMerchant(rawInput: string): string {
  let raw = " " + (rawInput || "").toUpperCase() + " ";

  raw = raw.replace(/[\/@|:;,]+/g, " ");
  // Payment rail / channel prefixes used by Indian banks
  raw = raw.replace(
    /\b(UPI|IMPS|NEFT|RTGS|POS|ATM|ACH|ECS|NACH|MMT|INF|TPT|BIL|BILLPAY|VPS|CHQ|CARD|DC|CC|POSDEC|SI|POS PUR|PUR)\b/g,
    " ",
  );
  raw = raw.replace(/\bPAYMENT\s+FROM\b|\bPAYMENT\s+TO\b|\bPAID\s+TO\b|\bTXN\b|\bREF\b|\bRRN\b/g, " ");
  // Reference numbers, dates, long digit runs, card masks
  raw = raw.replace(/\bX{2,}\d+\b/g, " ");
  raw = raw.replace(/\b\d{4,}\b/g, " ");
  raw = raw.replace(/\*+\s*\w*/g, " ");
  raw = raw.replace(/\b[A-Z]*\d+[A-Z\d]*\b/g, " ");
  // Legal suffixes and noise words
  raw = raw.replace(
    /\b(PVT|PRIVATE|LTD|LIMITED|LLP|INC|TECHNOLOGIES|TECHNOLOGY|SOLUTIONS|SERVICES|INDIA|IN|BANGALORE|BENGALURU|MUMBAI|DELHI|GURGAON|HYDERABAD|PUNE|CHENNAI|ONLINE|STORE|RETAIL|COM|OKICICI|OKAXIS|OKHDFCBANK|OKSBI|YBL|PAYTM|APL|IBL|AXL)\b/g,
    " ",
  );
  raw = raw.replace(/[^A-Z0-9 &]/g, " ");
  const cleaned = raw.replace(/\s+/g, " ").trim();
  return cleaned.length >= 3 ? cleaned : (rawInput || "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** Display name: title-cased normalized merchant. */
export function merchantLabel(key: string): string {
  if (!key) return "Unknown";
  return key
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

interface Rule {
  match: RegExp;
  category: string;
  type?: TxnType;
  label?: string;
}

/** Built-in rules. User rules always take priority over these. */
const RULES: Rule[] = [
  { match: /\bSWIGGY\b/, category: "Food & Dining > Food Delivery", label: "Swiggy" },
  { match: /\bZOMATO\b/, category: "Food & Dining > Food Delivery", label: "Zomato" },
  { match: /\b(EATSURE|BOX ?8|FAASOS|DOMINOS|PIZZA HUT|MCDONALD|KFC|BURGER KING)\b/, category: "Food & Dining > Restaurants" },
  { match: /\b(STARBUCKS|CAFE|COFFEE|CHAAYOS|BLUE TOKAI|THIRD WAVE)\b/, category: "Food & Dining > Cafes" },
  { match: /\b(DMART|D MART|BIGBASKET|BIG BASKET|BLINKIT|ZEPTO|GROFERS|RELIANCE FRESH|MORE MEGASTORE|SPENCER|NATURES BASKET|INSTAMART)\b/, category: "Food & Dining > Groceries" },
  { match: /\b(RESTAURANT|BIRYANI|DHABA|BARBEQUE|SOCIAL|EATERY)\b/, category: "Food & Dining > Restaurants" },

  { match: /\bUBER\b/, category: "Transport > Uber/Ola", label: "Uber" },
  { match: /\b(OLA|OLACABS|ANI TECH)\b/, category: "Transport > Uber/Ola", label: "Ola" },
  { match: /\b(RAPIDO|BLUSMART|MERU)\b/, category: "Transport > Uber/Ola" },
  { match: /\b(INDIAN OIL|IOCL|HP PETROL|HPCL|BHARAT PETROLEUM|BPCL|SHELL|FUEL|PETROL PUMP)\b/, category: "Transport > Fuel" },
  { match: /\b(IRCTC|METRO|BMTC|DMRC|BEST BUS|REDBUS)\b/, category: "Transport > Public Transport" },
  { match: /\b(PARKING|FASTAG|NETC|PAYTM FASTAG)\b/, category: "Transport > Parking" },
  { match: /\b(INDIGO|AIR INDIA|VISTARA|SPICEJET|AKASA|MAKEMYTRIP|GOIBIBO|CLEARTRIP|YATRA|EASEMYTRIP|AIRBNB|OYO)\b/, category: "Transport > Flights/Travel" },

  { match: /\bAMAZON\b/, category: "Shopping > Online Shopping", label: "Amazon" },
  { match: /\b(FLIPKART|MEESHO|SNAPDEAL|TATA CLIQ|AJIO|NYKAA)\b/, category: "Shopping > Online Shopping" },
  { match: /\b(MYNTRA|ZARA|H&M|UNIQLO|LEVIS|DECATHLON|WESTSIDE|PANTALOONS)\b/, category: "Shopping > Clothing" },
  { match: /\b(CROMA|RELIANCE DIGITAL|APPLE|VIJAY SALES|BOAT|SAMSUNG)\b/, category: "Shopping > Electronics" },
  { match: /\b(IKEA|URBAN LADDER|PEPPERFRY|HOME CENTRE|HOMECENTRE)\b/, category: "Shopping > Home" },

  { match: /\b(BESCOM|MSEB|TATA POWER|ADANI ELECTRICITY|BSES|ELECTRICITY|TORRENT POWER)\b/, category: "Bills & Utilities > Electricity" },
  { match: /\b(AIRTEL|JIO|VODAFONE|VI RECHARGE|BSNL|RECHARGE)\b/, category: "Bills & Utilities > Mobile" },
  { match: /\b(ACT FIBERNET|HATHWAY|EXCITEL|BROADBAND|FIBERNET|TIKONA)\b/, category: "Bills & Utilities > Internet" },
  { match: /\b(RENT|LANDLORD|NOBROKER|HOUSING SOCIETY|MAINTENANCE CHARGE)\b/, category: "Bills & Utilities > Rent" },
  { match: /\b(GAS BILL|INDANE|WATER BILL|BBPS|BILLDESK)\b/, category: "Bills & Utilities > Other Bills" },

  { match: /\b(NETFLIX|SPOTIFY|PRIME VIDEO|HOTSTAR|DISNEY|SONYLIV|ZEE5|JIOCINEMA|YOUTUBE PREMIUM|APPLE TV|AUDIBLE)\b/, category: "Entertainment > Streaming" },
  { match: /\b(BOOKMYSHOW|PVR|INOX|CINEPOLIS)\b/, category: "Entertainment > Movies" },
  { match: /\b(STEAM|PLAYSTATION|XBOX|NINTENDO|EPIC GAMES|GOOGLE PLAY)\b/, category: "Entertainment > Games" },
  { match: /\b(DISTRICT|INSIDER|TICKETMASTER|EVENT)\b/, category: "Entertainment > Events" },

  { match: /\b(APOLLO PHARMACY|PHARMEASY|NETMEDS|TATA 1MG|1MG|MEDPLUS|WELLNESS FOREVER)\b/, category: "Health > Pharmacy" },
  { match: /\b(HOSPITAL|CLINIC|APOLLO|FORTIS|MANIPAL|MAX HEALTH|PRACTO|DIAGNOSTIC|LAB)\b/, category: "Health > Medical" },
  { match: /\b(CULT FIT|CULTFIT|GYM|FITNESS|GOLDS)\b/, category: "Health > Fitness" },

  { match: /\b(ZERODHA|GROWW|UPSTOX|COIN|SIP|MUTUAL FUND|MF PURCHASE|NIPPON|HDFC AMC|SBI MUTUAL|ICICI PRU MF|KUVERA|INDMONEY)\b/, category: "Finance > Investments" },
  { match: /\b(LIC|INSURANCE|POLICYBAZAAR|HDFC ERGO|ACKO|STAR HEALTH|BAJAJ ALLIANZ)\b/, category: "Finance > Insurance" },
  { match: /\b(CHARGES|CHRG|FEE|GST|ANNUAL FEE|SMS CHARGE|MIN BAL|PENALTY|AMB CHARGES)\b/, category: "Finance > Bank Charges" },
  { match: /\b(EMI|LOAN|HOME LOAN|CAR LOAN|BAJAJ FINSERV)\b/, category: "Finance > Loan/EMI" },
  { match: /\b(CREDIT CARD PAYMENT|CC PAYMENT|CARD PAYMENT|AUTOPAY CC)\b/, category: "Transfers > Credit Card Payment", type: "transfer" },

  { match: /\b(SALARY|SAL CREDIT|PAYROLL|WAGES)\b/, category: "Income > Salary", type: "income" },
  { match: /\b(FREELANCE|CONSULTING|INVOICE|UPWORK|FIVERR)\b/, category: "Income > Freelance", type: "income" },
  { match: /\b(INTEREST|INT PD|INT CREDIT|FD INTEREST)\b/, category: "Income > Interest", type: "income" },
  { match: /\b(REFUND|REVERSAL|CASHBACK)\b/, category: "Income > Refund", type: "income" },

  { match: /\b(ATM WDL|ATM CASH|CASH WITHDRAWAL|NWD|CASH WDL)\b/, category: "Transfers > Cash Withdrawal", type: "transfer" },
  { match: /\b(SELF|OWN ACCOUNT|SELF TRANSFER|TO SELF)\b/, category: "Transfers > Own Account Transfer", type: "transfer" },
];

export interface Categorization {
  categoryPath: string;
  confidence: number;
  source: "user-rule" | "built-in" | "fallback";
  type?: TxnType;
  label?: string;
}

/**
 * Categorize a transaction from its narration.
 * `userRules` maps a normalized merchant key to a category path and wins over built-ins.
 */
export function categorize(
  description: string,
  userRules: Record<string, { categoryPath: string; type?: TxnType }> = {},
): Categorization & { merchantKey: string } {
  const merchantKey = normalizeMerchant(description);
  const userRule = userRules[merchantKey];
  if (userRule) {
    return {
      merchantKey,
      categoryPath: userRule.categoryPath,
      confidence: 1,
      source: "user-rule",
      type: userRule.type,
    };
  }

  const haystack = " " + (description || "").toUpperCase().replace(/[^A-Z0-9&]+/g, " ") + " ";
  for (const rule of RULES) {
    if (rule.match.test(haystack)) {
      return {
        merchantKey,
        categoryPath: rule.category,
        confidence: 0.85,
        source: "built-in",
        type: rule.type,
        label: rule.label,
      };
    }
  }

  return { merchantKey, categoryPath: UNCATEGORIZED_PATH, confidence: 0.25, source: "fallback" };
}
