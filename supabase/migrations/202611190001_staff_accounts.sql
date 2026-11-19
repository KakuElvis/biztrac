-- Migration: Staff accounts with alphanumeric Staff ID and password authentication
-- Description: Enables store staff / cashiers to sign in using their unique Staff ID (e.g. AF190) and password,
-- keeping confidential business profit margins and cost prices hidden from counter cashiers.

create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id text not null,
  password_hash text not null,
  full_name text not null,
  phone text,
  email text,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, staff_id)
);

alter table public.staff_accounts add column if not exists is_active boolean not null default true;

create index if not exists staff_accounts_business_id_idx on public.staff_accounts(business_id);
create index if not exists staff_accounts_staff_id_idx on public.staff_accounts(staff_id);

alter table public.staff_accounts enable row level security;

-- Policies for staff_accounts
drop policy if exists "Members can view staff accounts for their business" on public.staff_accounts;
create policy "Members can view staff accounts for their business"
on public.staff_accounts for select using (
  public.is_business_member(business_id)
);

drop policy if exists "Managers can insert staff accounts" on public.staff_accounts;
create policy "Managers can insert staff accounts"
on public.staff_accounts for insert with check (
  public.can_manage_business(business_id)
);

drop policy if exists "Managers can update staff accounts" on public.staff_accounts;
create policy "Managers can update staff accounts"
on public.staff_accounts for update using (
  public.can_manage_business(business_id)
) with check (
  public.can_manage_business(business_id)
);

drop policy if exists "Managers can delete staff accounts" on public.staff_accounts;
create policy "Managers can delete staff accounts"
on public.staff_accounts for delete using (
  public.can_manage_business(business_id)
);

comment on table public.staff_accounts is 'Stores counter cashier and staff accounts authenticated with Staff ID and password';
comment on column public.staff_accounts.staff_id is 'Alphanumeric identifier (e.g. 2 uppercase letters + 3 numbers like AF190)';
