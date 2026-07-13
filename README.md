# BizTrac

BizTrac is a mobile-first business management PWA for Ghanaian SMEs. It supports Supabase-backed authentication, business workspaces, inventory, product categories, sales, expenses, reports, customers, and business settings, with a demo shop fallback when Supabase is not configured.

## Stack

- React + Vite
- Tailwind CSS
- Lucide React icons
- Recharts for report previews
- Supabase for auth, database, row-level security, and transactional sale recording

## Run Locally

```bash
npm install
copy .env.example .env
npm run dev
```

To enable live accounts and data:

1. Create a Supabase project.
2. Run the migrations in order, either with the Supabase CLI or in the Supabase SQL editor:
   - `supabase/migrations/202607080001_initial_schema.sql`
   - `supabase/migrations/202607130001_product_categories.sql`
   - `supabase/migrations/202607130002_record_sale_rpc.sql`
3. Add the project URL and anon key to `.env`.

Without Supabase environment keys, the app remains available through **Use demo shop**.

## Checks

```bash
npm run lint
npm run build
npm run check
```

`npm run check` runs lint first, then the production build.

## Current Focus

- Mobile-first app shell with bottom navigation
- Register/login with business workspace provisioning
- Dashboard overview with sales, stock, expenses, debtors, and estimated profit
- Inventory CRUD with boutique fields and business-defined categories
- Fast sale flow with customer selection/creation, credit sales, transactional stock decrementing, and printable/shareable receipts
- Expense capture and history backed by Supabase
- Reports for daily sales, profit, expenses, best sellers, low stock, and debtors
- Business profile editing from the More screen

The sale flow depends on the `record_sale(...)` Postgres RPC so that sale creation, line-item insertion, customer association, and stock decrementing happen in one database transaction.
