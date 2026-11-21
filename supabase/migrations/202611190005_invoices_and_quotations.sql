-- Migration: Invoices, Quotations, and Billing Documents
-- File: 202611190005_invoices_and_quotations.sql
-- Description: Adds tables and RLS policies for professional A4 commercial invoices,
-- estimates/quotations, proforma invoices, and receipts.

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  doc_number text not null,
  doc_type text not null default 'invoice' check (doc_type in ('quotation', 'invoice', 'receipt', 'proforma')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'declined', 'cancelled')),
  customer_name text not null,
  customer_phone text,
  customer_email text,
  customer_address text,
  issue_date date not null default current_date,
  due_date date,
  tax_rate numeric(5, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  payment_terms text,
  bank_momo_details text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, doc_number)
);

create table if not exists public.billing_document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists billing_documents_business_id_idx on public.billing_documents(business_id);
create index if not exists billing_documents_doc_number_idx on public.billing_documents(doc_number);
create index if not exists billing_document_items_doc_id_idx on public.billing_document_items(document_id);

-- Enable RLS
alter table public.billing_documents enable row level security;
alter table public.billing_document_items enable row level security;

-- Policies for billing_documents
drop policy if exists "Members can read billing documents" on public.billing_documents;
create policy "Members can read billing documents"
on public.billing_documents for select
to anon, authenticated
using (business_id is not null);

drop policy if exists "Members can insert billing documents" on public.billing_documents;
create policy "Members can insert billing documents"
on public.billing_documents for insert
to anon, authenticated
with check (business_id is not null);

drop policy if exists "Members can update billing documents" on public.billing_documents;
create policy "Members can update billing documents"
on public.billing_documents for update
to anon, authenticated
using (business_id is not null)
with check (business_id is not null);

drop policy if exists "Members can delete billing documents" on public.billing_documents;
create policy "Members can delete billing documents"
on public.billing_documents for delete
to anon, authenticated
using (business_id is not null);

-- Policies for billing_document_items
drop policy if exists "Members can read billing document items" on public.billing_document_items;
create policy "Members can read billing document items"
on public.billing_document_items for select
to anon, authenticated
using (true);

drop policy if exists "Members can insert billing document items" on public.billing_document_items;
create policy "Members can insert billing document items"
on public.billing_document_items for insert
to anon, authenticated
with check (true);

drop policy if exists "Members can delete billing document items" on public.billing_document_items;
create policy "Members can delete billing document items"
on public.billing_document_items for delete
to anon, authenticated
using (true);
