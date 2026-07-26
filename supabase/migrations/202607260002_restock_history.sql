-- Migration: Product Restocks & Price History Ledger
-- Description: Creates public.product_restocks table and atomic restock_product RPC function.

create table if not exists public.product_restocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_added integer not null check (quantity_added > 0),
  previous_quantity integer not null default 0,
  new_quantity integer not null default 0,
  old_cost_price numeric(12,2) not null default 0,
  new_cost_price numeric(12,2) not null default 0,
  old_selling_price numeric(12,2) not null default 0,
  new_selling_price numeric(12,2) not null default 0,
  supplier_name text default '',
  notes text default '',
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.product_restocks enable row level security;

-- RLS Policies
create policy "Members can view product restocks"
  on public.product_restocks
  for select
  using (
    exists (
      select 1 from public.business_members
      where business_members.business_id = product_restocks.business_id
        and business_members.user_id = auth.uid()
    )
  );

create policy "Members can create product restocks"
  on public.product_restocks
  for insert
  with check (
    exists (
      select 1 from public.business_members
      where business_members.business_id = product_restocks.business_id
        and business_members.user_id = auth.uid()
    )
  );

-- Function: Atomic Restock RPC
create or replace function public.restock_product(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity_added integer,
  p_new_cost_price numeric,
  p_new_selling_price numeric,
  p_supplier_name text default '',
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_product public.products%rowtype;
  v_prev_qty integer;
  v_new_qty integer;
  v_old_cost numeric;
  v_old_selling numeric;
  v_restock_id uuid;
begin
  if p_quantity_added is null or p_quantity_added <= 0 then
    raise exception 'Quantity added must be greater than zero.';
  end if;

  -- Lock product row for update
  select * into v_product
  from public.products
  where id = p_product_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  v_prev_qty := v_product.quantity;
  v_new_qty := v_prev_qty + p_quantity_added;
  v_old_cost := v_product.cost_price;
  v_old_selling := v_product.selling_price;

  -- Update product quantity and prices
  update public.products
  set
    quantity = v_new_qty,
    cost_price = coalesce(p_new_cost_price, v_old_cost),
    selling_price = coalesce(p_new_selling_price, v_old_selling),
    updated_at = now()
  where id = p_product_id and business_id = p_business_id;

  -- Insert restock log
  insert into public.product_restocks (
    business_id,
    product_id,
    quantity_added,
    previous_quantity,
    new_quantity,
    old_cost_price,
    new_cost_price,
    old_selling_price,
    new_selling_price,
    supplier_name,
    notes
  ) values (
    p_business_id,
    p_product_id,
    p_quantity_added,
    v_prev_qty,
    v_new_qty,
    v_old_cost,
    coalesce(p_new_cost_price, v_old_cost),
    v_old_selling,
    coalesce(p_new_selling_price, v_old_selling),
    coalesce(p_supplier_name, ''),
    coalesce(p_notes, '')
  )
  returning id into v_restock_id;

  return jsonb_build_object(
    'restock_id', v_restock_id,
    'product_id', p_product_id,
    'previous_quantity', v_prev_qty,
    'new_quantity', v_new_qty,
    'cost_price', coalesce(p_new_cost_price, v_old_cost),
    'selling_price', coalesce(p_new_selling_price, v_old_selling)
  );
end;
$$;
