create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  phone text,
  email text,
  location text,
  logo_url text,
  currency text not null default 'GHS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text,
  sku text,
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  low_stock_limit integer not null default 0 check (low_stock_limit >= 0),
  supplier text,
  size text,
  colour text,
  brand text,
  item_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  reference text not null,
  payment_method text not null check (payment_method in ('cash', 'momo', 'bank', 'credit')),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  notes text,
  sold_by uuid references auth.users(id) on delete set null,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, reference)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'momo', 'bank')),
  notes text,
  incurred_on date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_business_id_idx on public.products(business_id);
create index customers_business_id_idx on public.customers(business_id);
create index sales_business_sold_at_idx on public.sales(business_id, sold_at desc);
create index sale_items_sale_id_idx on public.sale_items(sale_id);
create index expenses_business_incurred_on_idx on public.expenses(business_id, incurred_on desc);
create index business_members_user_id_idx on public.business_members(user_id);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = target_business_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = target_business_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_business_id uuid;
  business_name text;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  business_name := nullif(trim(new.raw_user_meta_data ->> 'business_name'), '');

  if business_name is not null then
    insert into public.businesses (owner_id, name, phone, email, location)
    values (
      new.id,
      business_name,
      nullif(trim(new.raw_user_meta_data ->> 'business_phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'business_email'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'business_location'), '')
    )
    returning id into new_business_id;

    insert into public.business_members (business_id, user_id, role)
    values (new_business_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;

create policy "Users can read their profile"
on public.profiles for select using (id = auth.uid());
create policy "Users can update their profile"
on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read businesses"
on public.businesses for select using (public.is_business_member(id));
create policy "Managers can update businesses"
on public.businesses for update using (public.can_manage_business(id))
with check (public.can_manage_business(id));

create policy "Members can read memberships"
on public.business_members for select using (public.is_business_member(business_id));
create policy "Managers can add memberships"
on public.business_members for insert with check (public.can_manage_business(business_id));
create policy "Managers can update memberships"
on public.business_members for update using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));
create policy "Managers can delete memberships"
on public.business_members for delete using (
  public.can_manage_business(business_id) and user_id <> auth.uid()
);

create policy "Members can read products"
on public.products for select using (public.is_business_member(business_id));
create policy "Members can add products"
on public.products for insert with check (public.is_business_member(business_id));
create policy "Members can update products"
on public.products for update using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));
create policy "Managers can delete products"
on public.products for delete using (public.can_manage_business(business_id));

create policy "Members can read customers"
on public.customers for select using (public.is_business_member(business_id));
create policy "Members can add customers"
on public.customers for insert with check (public.is_business_member(business_id));
create policy "Members can update customers"
on public.customers for update using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));
create policy "Managers can delete customers"
on public.customers for delete using (public.can_manage_business(business_id));

create policy "Members can read sales"
on public.sales for select using (public.is_business_member(business_id));
create policy "Members can add sales"
on public.sales for insert with check (
  public.is_business_member(business_id) and sold_by = auth.uid()
);
create policy "Managers can update sales"
on public.sales for update using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));
create policy "Managers can delete sales"
on public.sales for delete using (public.can_manage_business(business_id));

create policy "Members can read sale items"
on public.sale_items for select using (
  exists (
    select 1 from public.sales
    where sales.id = sale_items.sale_id
      and public.is_business_member(sales.business_id)
  )
);
create policy "Members can add sale items"
on public.sale_items for insert with check (
  exists (
    select 1 from public.sales
    where sales.id = sale_items.sale_id
      and public.is_business_member(sales.business_id)
  )
);
create policy "Managers can update sale items"
on public.sale_items for update using (
  exists (
    select 1 from public.sales
    where sales.id = sale_items.sale_id
      and public.can_manage_business(sales.business_id)
  )
);
create policy "Managers can delete sale items"
on public.sale_items for delete using (
  exists (
    select 1 from public.sales
    where sales.id = sale_items.sale_id
      and public.can_manage_business(sales.business_id)
  )
);

create policy "Members can read expenses"
on public.expenses for select using (public.is_business_member(business_id));
create policy "Members can add expenses"
on public.expenses for insert with check (
  public.is_business_member(business_id) and created_by = auth.uid()
);
create policy "Members can update expenses"
on public.expenses for update using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));
create policy "Managers can delete expenses"
on public.expenses for delete using (public.can_manage_business(business_id));
