/**
 * QuickBooks Online's account types.
 *
 * This is QBO's published AccountType enumeration, held here as a list rather
 * than fetched: the API needs an OAuth-connected company, and a chart of
 * accounts must be usable before anyone connects one. The values match QBO
 * exactly, so a chart built here reconciles with theirs.
 *
 * If the live list is ever wanted, it comes from
 * `GET /v3/company/{realmId}/query?query=SELECT * FROM Account` — that needs a
 * client id, secret and realm id, which belong in Settings, not in code.
 */
export const QBO_ACCOUNT_TYPES = [
  // Assets
  "Bank",
  "Accounts Receivable",
  "Other Current Asset",
  "Fixed Asset",
  "Other Asset",
  // Liabilities
  "Accounts Payable",
  "Credit Card",
  "Other Current Liability",
  "Long Term Liability",
  // Equity
  "Equity",
  // Income
  "Income",
  "Other Income",
  // Expense
  "Cost of Goods Sold",
  "Expense",
  "Other Expense",
] as const;

export type QboAccountType = (typeof QBO_ACCOUNT_TYPES)[number];

export const isQboAccountType = (v: string): v is QboAccountType =>
  (QBO_ACCOUNT_TYPES as readonly string[]).includes(v);

/**
 * QBO's account subtypes, under the type each one belongs to. Names are given
 * as QuickBooks displays them rather than as its API constants, since this
 * list is read by people rather than posted to the API.
 *
 * The common subtypes are here; QBO's full enumeration is longer and varies by
 * locale, so a chart that needs one not listed can be added as its own line.
 */
export const QBO_SUBTYPES: Record<string, string[]> = {
  Bank: ["Cash on hand", "Checking", "Money Market", "Savings", "Trust Accounts", "Rents Held in Trust"],
  "Accounts Receivable": ["Accounts Receivable"],
  "Other Current Asset": [
    "Allowance for Bad Debts", "Employee Cash Advances", "Inventory", "Prepaid Expenses",
    "Undeposited Funds", "Loans to Officers", "Loans to Others", "Retainage",
    "Other Current Assets",
  ],
  "Fixed Asset": [
    "Accumulated Depreciation", "Buildings", "Furniture and Fixtures", "Land",
    "Leasehold Improvements", "Machinery and Equipment", "Vehicles",
    "Computers", "Software", "Other Fixed Assets",
  ],
  "Other Asset": [
    "Accumulated Amortization of Other Assets", "Goodwill", "Lease Buyout", "Licenses",
    "Organizational Costs", "Security Deposits", "Other Long Term Assets",
  ],
  "Accounts Payable": ["Accounts Payable"],
  "Credit Card": ["Credit Card"],
  "Other Current Liability": [
    "Direct Deposit Payable", "Federal Income Tax Payable", "Insurance Payable",
    "Line of Credit", "Loan Payable", "Payroll Clearing", "Payroll Tax Payable",
    "Sales Tax Payable", "State/Local Income Tax Payable", "Other Current Liabilities",
  ],
  "Long Term Liability": [
    "Notes Payable", "Shareholder Notes Payable", "Other Long Term Liabilities",
  ],
  Equity: [
    "Opening Balance Equity", "Owner's Equity", "Retained Earnings", "Common Stock",
    "Preferred Stock", "Treasury Stock", "Partner Contributions", "Partner Distributions",
    "Paid-In Capital or Surplus",
  ],
  Income: [
    "Sales of Product Income", "Service/Fee Income", "Discounts/Refunds Given",
    "Non-Profit Income", "Other Primary Income", "Unapplied Cash Payment Income",
  ],
  "Other Income": [
    "Dividend Income", "Interest Earned", "Tax-Exempt Interest",
    "Gain/Loss on Sale of Fixed Assets", "Other Investment Income",
    "Other Miscellaneous Income",
  ],
  "Cost of Goods Sold": [
    "Cost of Labor - COS", "Equipment Rental - COS", "Shipping, Freight & Delivery - COS",
    "Supplies & Materials - COGS", "Other Costs of Services - COS",
  ],
  Expense: [
    "Advertising/Promotional", "Auto", "Bad Debts", "Bank Charges",
    "Charitable Contributions", "Commissions & Fees", "Dues & Subscriptions",
    "Entertainment", "Entertainment Meals", "Equipment Rental", "Insurance",
    "Interest Paid", "Legal & Professional Fees", "Office/General Administrative Expenses",
    "Payroll Expenses", "Promotional Meals", "Rent or Lease of Buildings",
    "Repair & Maintenance", "Shipping, Freight & Delivery", "Supplies & Materials",
    "Taxes Paid", "Travel", "Travel Meals", "Utilities", "Other Business Expenses",
  ],
  "Other Expense": [
    "Amortization", "Depreciation", "Exchange Gain or Loss", "Home Office",
    "Penalties & Settlements", "Other Miscellaneous Expense",
  ],
};

export const subtypesFor = (type: string): string[] => QBO_SUBTYPES[type] ?? [];
