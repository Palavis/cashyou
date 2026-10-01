# SpendWise Insights

Build a private personal finance web app called SpendWise.

The purpose of the app is to let me upload my bank statement and automatically convert the transactions into categorized expenses/income, then show useful spending insights.

IMPORTANT — PRIVACY & SECURITY FIRST

This app will handle sensitive financial information.

Design the architecture with privacy as a priority:

Do NOT expose database credentials, service-role keys, API keys, or secrets in frontend code.

Use proper authentication so each user's financial data is isolated.

If using Supabase, enable Row Level Security (RLS) on every user-data table.

Users must only be able to access their own transactions and data.

Uploaded bank statements should NOT be permanently retained by default.

Process the uploaded statement, extract the required transaction data, and delete the original uploaded file after successful processing.

Never log bank statements, account numbers, balances, or transaction descriptions unnecessarily.

Do not display full account numbers anywhere in the UI.

Provide a clear delete-all-data option.

Build the app so it is suitable for private/personal use rather than a public financial-data marketplace.

For the first version, use sample/mock bank statements to test the complete flow. Do not require me to upload a real bank statement to demonstrate the app.

CORE FLOW

The main workflow should be:

Upload Bank Statement

Detect the file format

Extract transactions

Normalize transactions

Automatically categorize transactions

Show a review screen

Allow me to correct categories

Remember my corrections for future statements

Add the finalized transactions to my dashboard

Show spending analytics

SUPPORTED FILES

Initially support:

CSV

XLSX

PDF

The parser should try to identify common columns such as:

Date

Description / Narration

Debit

Credit

Amount

Transaction type

Balance

Different banks use different column names, so create a flexible transaction-mapping step when automatic detection is uncertain.

For PDFs, account for common Indian bank statement formats and variations in debit/credit notation.

Do NOT assume every bank uses the same format.

TRANSACTION DATA MODEL

Each transaction should have:

transaction date

description

amount

transaction type: income / expense / transfer

category

subcategory

merchant/payee

source statement

user_id

confidence score for automatic categorization

created_at

Do not store unnecessary sensitive information from the original statement.

DEFAULT CATEGORIES

Create these categories:

Food & Dining

Restaurants

Food Delivery

Cafes

Groceries

Transport

Uber/Ola

Fuel

Public Transport

Parking

Flights/Travel

Shopping

Online Shopping

Clothing

Electronics

Home

Bills & Utilities

Electricity

Mobile

Internet

Rent

Other Bills

Entertainment

Streaming

Movies

Games

Events

Health

Pharmacy

Medical

Fitness

Finance

Investments

Insurance

Bank Charges

Credit Card Payment

Loan/EMI

Income

Salary

Freelance

Interest

Refund

Other Income

Transfers

Own Account Transfer

Credit Card Payment

Cash Withdrawal

Other Transfer

Other

Uncategorized

Make categories fully editable by the user.

SMART CATEGORIZATION

Start with a rules-based categorization engine.

For example:

SWIGGY → Food Delivery ZOMATO → Food Delivery UBER → Uber/Ola OLA → Uber/Ola NETFLIX → Streaming AMAZON → Online Shopping DMART → Groceries

The system should normalize merchant names so that variations such as:

"SWIGGY*12345" "SWIGGY FOOD" "SWIGGY IN"

can potentially be recognized as the same merchant.

When I manually change a transaction's category, provide an option:

"Remember this merchant"

If selected, future transactions from that merchant should automatically use the selected category.

Show an "Auto-categorized" indicator and a confidence level.

TRANSACTION REVIEW SCREEN

After importing a statement, show a table with:

Date | Merchant/Description | Amount | Type | Category | Confidence | Actions

Allow:

Edit category

Edit merchant

Change income/expense/transfer

Split transaction

Exclude transaction

Bulk-select transactions

Bulk change category

Highlight low-confidence transactions so I can review them quickly.

Before importing, show:

Number of transactions found

Total income

Total expenses

Transfers

Number of transactions requiring review

Then provide:

Import Transactions

DASHBOARD

Create a clean modern dashboard.

Top cards:

Total Income

Total Expenses

Net Cash Flow

Savings Rate

Charts:

Spending by Category

Income vs Expenses over time

Monthly spending trend

Top merchants

Recurring expenses

Daily/weekly spending trend

Allow filtering by:

Month

Date range

Category

Merchant

Income/Expense/Transfer

When I click a chart category, the transaction list should update to show only those transactions.

MONTHLY VIEW

Create a monthly financial summary:

September 2026

Income Expenses Savings Savings %

Then category breakdown:

Food & Dining — ₹X Shopping — ₹X Transport — ₹X Bills — ₹X Entertainment — ₹X etc.

Show comparison with the previous month:

Spending increased/decreased

Biggest category increase

Biggest category decrease

RECURRING TRANSACTIONS

Detect potential recurring transactions based on:

Similar merchant

Similar amount

Similar time interval

Examples: Netflix every month Rent every month SIP every month Insurance annually

Show them separately as:

Recurring Expenses

with estimated monthly recurring cost.

SEARCH

Add a global transaction search.

I should be able to search:

"swiggy" "amazon" "uber" "₹500" "groceries"

and immediately see matching transactions.

DATA IMPORT SAFETY

Before importing a statement, show a warning:

"This file may contain sensitive financial information. Your statement is processed only to extract transactions. The original file should not be retained after processing."

Do not show full account numbers.

If account information is detected, mask it.

UI/UX

Make the UI:

Minimal

Modern

Clean

Desktop + mobile responsive

Easy to understand

Not overly colorful

Finance-dashboard style

Use cards, tables and simple charts.

The primary screen should immediately show:

Upload Statement

with drag-and-drop support.

Also provide:

View Transactions Dashboard Categories Settings

IMPORTANT DEVELOPMENT APPROACH

Build this as an MVP first.

Do NOT add unnecessary features such as:

bank account connections

automatic bank login

UPI integrations

investment trading

payment initiation

credit score

financial advice

The app should only analyze statements that I explicitly upload.

First build the UI and complete flow using mock transaction data.

Then implement the actual CSV/XLSX import.

Then PDF parsing.

Then categorization rules.

Then persistence/database.

At every stage, clearly show me what has been implemented and what remains.

Before writing code, give me a short architecture plan describing:

Frontend

Backend

Database

File processing

Categorization engine

Authentication

Security/privacy controls

Do not proceed with insecure shortcuts just to make the demo work.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cashyou.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eabafc09-2919-4b87-9844-6c542e2ef915).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
