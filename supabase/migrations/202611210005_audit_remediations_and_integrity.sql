-- Migration: 202611210005_audit_remediations_and_integrity.sql
-- Description:
-- 1. Restores active debt status filter on customer_balances view.
-- 2. Adds composite index on sales(business_id, customer_id) to eliminate sequential table scans.
-- 3. Hardens restock_product RPC with manager authorization and explicit search path.
-- 4. Creates debt_payments audit table and updates pay_debt to record payment ledger entries and support counter cashiers.
-- 5. Updates list_counter_products to support counter cashier sessions with staff attribution.
-- 6. Hardens record_sale RPC:
--    - Authorizes counter cashiers (v_user_id is null) using verified, active staff_account_id.
--    - Harmonizes Ghana VAT calculation to standard additive 20% (15% VAT + 2.5% NHIL + 2.5% GETFund) matching client tax engine, eliminating walk-in sale crashes (23514).

set search_path = public, extensions;

-- ============================================================================
-- 1. Restore Active Debt Status Filter on customer_balances View
-- ============================================================================
create or replace view public.customer_balances with (security_invoker = true) as
select
  s.business_id,
  s.customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  sum(s.total - s.amount_paid) as total_debt,
  count(s.id) as unpaid_sales_count,
  max(s.sold_at) as latest_sale_at
from public.sales s
left join public.customers c on c.id = s.customer_id
where s.total > s.amount_paid
  and s.debt_status = 'active'
group by s.business_id, s.customer_id, c.name, c.phone;

revoke all on public.customer_balances from anon, public;
grant select on public.customer_balances to authenticated;

-- ============================================================================
-- 2. Performance: Composite Index on sales(business_id, customer_id)
-- ============================================================================
create index if not exists sales_business_customer_idx
  on public.sales(business_id, customer_id);

-- ============================================================================
-- 3. Authorization Hardening on restock_product RPC
-- ============================================================================
create or replace function public.restock_product(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity_added integer,
  p_new_cost_price numeric,
  p_new_selling_price numeric,
  p_supplier_name text default '',
  p_notes text default '',
  p_cost_method text default 'avco'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_product public.products%rowtype;
  v_prev_qty integer;
  v_new_qty integer;
  v_old_cost numeric;
  v_old_selling numeric;
  v_effective_cost numeric;
  v_restock_id uuid;
  v_method text;
begin
  if not public.can_manage_business(p_business_id) then
    raise exception 'Unauthorized. Manager privileges are required to restock inventory.' using errcode = '42501';
  end if;

  if p_quantity_added is null or p_quantity_added <= 0 then
    raise exception 'Quantity added must be greater than zero.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  v_prev_qty := coalesce(v_product.quantity, 0);
  v_new_qty := v_prev_qty + p_quantity_added;
  v_old_cost := coalesce(v_product.cost_price, 0);
  v_old_selling := coalesce(v_product.selling_price, 0);
  v_method := lower(trim(coalesce(p_cost_method, 'avco')));

  if p_new_cost_price is null then
    v_effective_cost := v_old_cost;
  elsif v_method = 'latest' or v_prev_qty <= 0 then
    v_effective_cost := round(p_new_cost_price, 2);
  else
    v_effective_cost := round(
      ((v_prev_qty * v_old_cost) + (p_quantity_added * p_new_cost_price)) / v_new_qty,
      2
    );
  end if;

  update public.products
  set
    quantity = v_new_qty,
    cost_price = v_effective_cost,
    selling_price = coalesce(p_new_selling_price, v_old_selling),
    updated_at = now()
  where id = p_product_id and business_id = p_business_id;

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
    notes,
    cost_method
  ) values (
    p_business_id,
    p_product_id,
    p_quantity_added,
    v_prev_qty,
    v_new_qty,
    v_old_cost,
    v_effective_cost,
    v_old_selling,
    coalesce(p_new_selling_price, v_old_selling),
    coalesce(p_supplier_name, ''),
    coalesce(p_notes, ''),
    v_method
  )
  returning id into v_restock_id;

  return jsonb_build_object(
    'restock_id', v_restock_id,
    'product_id', p_product_id,
    'previous_quantity', v_prev_qty,
    'new_quantity', v_new_qty,
    'cost_price', v_effective_cost,
    'selling_price', coalesce(p_new_selling_price, v_old_selling),
    'cost_method', v_method
  );
end;
$$;

grant execute on function public.restock_product(uuid, uuid, integer, numeric, numeric, text, text, text) to authenticated;

-- ============================================================================
-- 4. Financial Audit: debt_payments Table & Hardened pay_debt RPC
-- ============================================================================
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null default 'cash',
  staff_account_id uuid references public.staff_accounts(id) on delete set null,
  receipt_reference text not null,
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_business_created_at_idx
  on public.debt_payments(business_id, created_at desc);

create index if not exists debt_payments_customer_idx
  on public.debt_payments(customer_id);

alter table public.debt_payments enable row level security;
drop policy if exists "Members can read debt payments" on public.debt_payments;
create policy "Members can read debt payments"
  on public.debt_payments for select to authenticated
  using (public.is_business_member(business_id));

drop function if exists public.pay_debt(uuid, uuid, numeric, text, uuid);
drop function if exists public.pay_debt(uuid, uuid, numeric, text);

create or replace function public.pay_debt(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_staff_account_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale record;
  v_remaining numeric(12, 2) := greatest(0, p_amount);
  v_applied numeric(12, 2) := 0;
  v_needed numeric(12, 2);
  v_pay_amount numeric(12, 2);
begin
  if v_user_id is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'You are not a member of this business.' using errcode = '42501';
    end if;
  else
    -- Cashier counter session
    if p_staff_account_id is not null then
      if not exists (
        select 1 from public.staff_accounts
        where id = p_staff_account_id
          and business_id = p_business_id
          and (locked_until is null or locked_until <= clock_timestamp())
      ) then
        raise exception 'Staff account is invalid or temporarily locked.' using errcode = '42501';
      end if;
    else
      if not exists (select 1 from public.businesses where id = p_business_id) then
        raise exception 'Store not found or invalid business.' using errcode = '42501';
      end if;
    end if;
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id
      and business_id = p_business_id
  ) then
    raise exception 'Customer was not found in this business.' using errcode = 'P0002';
  end if;

  if v_remaining <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  for v_sale in
    select id, total, amount_paid
    from public.sales
    where business_id = p_business_id
      and customer_id = p_customer_id
      and total > amount_paid
      and debt_status = 'active'
    order by sold_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_needed := v_sale.total - v_sale.amount_paid;
    v_pay_amount := least(v_remaining, v_needed);

    update public.sales
    set amount_paid = amount_paid + v_pay_amount
    where id = v_sale.id;

    insert into public.debt_payments (
      business_id,
      customer_id,
      sale_id,
      amount,
      payment_method,
      staff_account_id,
      receipt_reference,
      created_at
    ) values (
      p_business_id,
      p_customer_id,
      v_sale.id,
      v_pay_amount,
      coalesce(p_payment_method, 'cash'),
      p_staff_account_id,
      'BT-PAY-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 4)),
      clock_timestamp()
    );

    v_remaining := v_remaining - v_pay_amount;
    v_applied := v_applied + v_pay_amount;
  end loop;

  return v_applied;
end;
$$;

grant execute on function public.pay_debt(uuid, uuid, numeric, text, uuid) to anon, authenticated;

-- ============================================================================
-- 5. Hardened list_counter_products RPC for Cashier Sessions
-- ============================================================================
drop function if exists public.list_counter_products(uuid, text, text, uuid);
drop function if exists public.list_counter_products(uuid, text, text);

create or replace function public.list_counter_products(
  p_business_id uuid,
  p_category text default null,
  p_search text default null,
  p_staff_account_id uuid default null
)
returns table (
  id uuid,
  business_id uuid,
  name text,
  category text,
  sku text,
  selling_price numeric,
  quantity integer,
  low_stock_limit integer,
  supplier text,
  size text,
  colour text,
  brand text,
  item_type text,
  tax_treatment text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required.' using errcode = '42501';
    end if;
  else
    if p_staff_account_id is not null then
      if not exists (
        select 1 from public.staff_accounts
        where id = p_staff_account_id
          and business_id = p_business_id
          and (locked_until is null or locked_until <= clock_timestamp())
      ) then
        raise exception 'Staff account is invalid or temporarily locked.' using errcode = '42501';
      end if;
    else
      if not exists (select 1 from public.businesses where id = p_business_id) then
        raise exception 'Store not found or invalid business.' using errcode = '42501';
      end if;
    end if;
  end if;

  return query
  select
    p.id,
    p.business_id,
    p.name,
    coalesce(p.category, ''),
    coalesce(p.sku, ''),
    p.selling_price,
    p.quantity,
    p.low_stock_limit,
    coalesce(p.supplier, ''),
    coalesce(p.size, ''),
    coalesce(p.colour, ''),
    coalesce(p.brand, ''),
    coalesce(p.item_type, ''),
    coalesce(p.tax_treatment, 'standard')
  from public.products p
  where p.business_id = p_business_id
    and (p_category is null or p.category = trim(p_category))
    and (
      p_search is null
      or p.name ilike ('%' || trim(p_search) || '%')
      or p.sku ilike ('%' || trim(p_search) || '%')
      or p.brand ilike ('%' || trim(p_search) || '%')
    )
  order by p.name;
end;
$$;

grant execute on function public.list_counter_products(uuid, text, text, uuid) to anon, authenticated;

-- ============================================================================
-- 6. Hardened record_sale RPC with Cashier Authorization & Additive Ghana VAT
-- ============================================================================
drop function if exists public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, uuid, uuid);

create or replace function public.record_sale(
  p_business_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_notes text default null,
  p_amount_paid numeric default null,
  p_due_date date default null,
  p_staff_account_id uuid default null,
  p_client_sale_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_sale public.sales%rowtype;
  v_biz public.businesses%rowtype;
  v_sale_id uuid := gen_random_uuid();
  v_reference text;
  v_customer_id uuid := p_customer_id;
  v_customer public.customers%rowtype;
  v_customer_json jsonb := null;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;

  -- Tax variables (Ghana consumption tax)
  v_vat_enabled boolean := false;
  v_pricing_mode text := 'exclusive';
  v_vat_rate numeric(5, 4) := 0.15;
  v_nhil_rate numeric(5, 4) := 0.025;
  v_getfund_rate numeric(5, 4) := 0.025;
  v_combined_rate numeric(5, 4) := 0.20;

  v_item_raw numeric(12, 2);
  v_taxable_amount numeric(12, 2);
  v_item_nhil numeric(12, 2);
  v_item_getfund numeric(12, 2);
  v_item_vat numeric(12, 2);
  v_item_tax numeric(12, 2);
  v_line_total numeric(12, 2);

  v_subtotal_ex_tax numeric(12, 2) := 0;
  v_total_nhil numeric(12, 2) := 0;
  v_total_getfund numeric(12, 2) := 0;
  v_total_vat numeric(12, 2) := 0;
  v_total_tax numeric(12, 2) := 0;
  v_grand_total numeric(12, 2) := 0;
  v_amount_paid numeric(12, 2) := 0;

  v_updated_product public.products%rowtype;
  v_updated_products jsonb := '[]'::jsonb;
  v_sale public.sales%rowtype;
begin
  -- Validate business membership or counter session
  if v_user_id is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required to record sales.' using errcode = '42501';
    end if;
  else
    -- Cashier counter session
    if p_staff_account_id is not null then
      if not exists (
        select 1 from public.staff_accounts
        where id = p_staff_account_id
          and business_id = p_business_id
          and (locked_until is null or locked_until <= clock_timestamp())
      ) then
        raise exception 'Staff account is invalid or temporarily locked.' using errcode = '42501';
      end if;
    else
      if not exists (select 1 from public.businesses where id = p_business_id) then
        raise exception 'Store not found or invalid business.' using errcode = '42501';
      end if;
    end if;
  end if;

  select * into v_biz
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'Store not found or invalid business.' using errcode = '42501';
  end if;

  if p_client_sale_id is not null then
    select * into v_existing_sale from public.sales where business_id = p_business_id and client_sale_id = p_client_sale_id;
    if found then
      return jsonb_build_object('sale', to_jsonb(v_existing_sale), 'customer', null, 'updated_products', '[]'::jsonb);
    end if;
  end if;

  -- Read business tax settings
  v_vat_enabled := coalesce(v_biz.vat_enabled, false);
  v_pricing_mode := coalesce(v_biz.tax_pricing_mode, 'exclusive');
  v_vat_rate := coalesce(v_biz.vat_rate, 15.00) / 100.0;
  v_nhil_rate := coalesce(v_biz.nhil_rate, 2.50) / 100.0;
  v_getfund_rate := coalesce(v_biz.getfund_rate, 2.50) / 100.0;
  -- Standard additive Ghana consumption tax rate (15% VAT + 2.5% NHIL + 2.5% GETFund = 20.00%)
  v_combined_rate := v_vat_rate + v_nhil_rate + v_getfund_rate;

  if p_payment_method not in ('cash', 'momo', 'bank', 'credit') then
    raise exception 'Unsupported payment method.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product to the cart.';
  end if;

  if p_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = p_customer_id
      and business_id = p_business_id;

    if not found then
      raise exception 'Selected customer was not found.';
    end if;

    v_customer_json := to_jsonb(v_customer);
  elsif nullif(trim(coalesce(p_customer_name, '')), '') is not null then
    insert into public.customers (business_id, name, phone)
    values (
      p_business_id,
      trim(p_customer_name),
      nullif(trim(coalesce(p_customer_phone, '')), '')
    )
    returning * into v_customer;

    v_customer_id := v_customer.id;
    v_customer_json := to_jsonb(v_customer);
  end if;

  if p_payment_method = 'credit' and v_customer_id is null then
    raise exception 'Credit sales require a customer.';
  end if;

  v_reference :=
    'BT-' ||
    to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') ||
    '-' ||
    upper(substr(gen_random_uuid()::text, 1, 6));

  insert into public.sales (
    id,
    business_id,
    customer_id,
    reference,
    payment_method,
    subtotal,
    discount,
    total,
    amount_paid,
    notes,
    sold_by,
    due_date,
    subtotal_ex_tax,
    total_nhil,
    total_getfund,
    total_vat,
    total_tax,
    tin_snapshot,
    tax_mode_snapshot,
    staff_account_id,
    client_sale_id
  )
  values (
    v_sale_id,
    p_business_id,
    v_customer_id,
    v_reference,
    p_payment_method,
    0,
    0,
    0,
    0,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_user_id,
    p_due_date,
    0,
    0,
    0,
    0,
    0,
    v_biz.tin_number,
    v_pricing_mode,
    p_staff_account_id,
    p_client_sale_id
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Sale quantities must be whole numbers greater than zero.';
    end if;

    select *
    into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'A cart product was not found.';
    end if;

    if v_product.quantity < v_quantity then
      raise exception '% only has % in stock.', v_product.name, v_product.quantity;
    end if;

    v_item_raw := round(v_quantity * v_product.selling_price, 2);

    -- Compute line taxes (matching client taxCalculator.js standard additive calculations)
    if (not v_vat_enabled) or (v_product.tax_treatment in ('zero_rated', 'exempt')) then
      v_taxable_amount := v_item_raw;
      v_item_nhil := 0;
      v_item_getfund := 0;
      v_item_vat := 0;
      v_item_tax := 0;
      v_line_total := v_item_raw;
    elsif v_pricing_mode = 'inclusive' then
      v_taxable_amount := round(v_item_raw / (1 + v_combined_rate), 2);
      v_item_nhil := round(v_taxable_amount * v_nhil_rate, 2);
      v_item_getfund := round(v_taxable_amount * v_getfund_rate, 2);
      v_item_vat := round(v_taxable_amount * v_vat_rate, 2);
      v_item_tax := v_item_nhil + v_item_getfund + v_item_vat;
      v_line_total := v_item_raw;
    else
      -- Exclusive pricing
      v_taxable_amount := v_item_raw;
      v_item_nhil := round(v_taxable_amount * v_nhil_rate, 2);
      v_item_getfund := round(v_taxable_amount * v_getfund_rate, 2);
      v_item_vat := round(v_taxable_amount * v_vat_rate, 2);
      v_item_tax := v_item_nhil + v_item_getfund + v_item_vat;
      v_line_total := v_taxable_amount + v_item_tax;
    end if;

    v_subtotal_ex_tax := v_subtotal_ex_tax + v_taxable_amount;
    v_total_nhil := v_total_nhil + v_item_nhil;
    v_total_getfund := v_total_getfund + v_item_getfund;
    v_total_vat := v_total_vat + v_item_vat;
    v_total_tax := v_total_tax + v_item_tax;
    v_grand_total := v_grand_total + v_line_total;

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      unit_cost,
      line_total,
      taxable_amount,
      nhil_amount,
      getfund_amount,
      vat_amount,
      total_tax,
      tax_treatment
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.selling_price,
      v_product.cost_price,
      v_line_total,
      v_taxable_amount,
      v_item_nhil,
      v_item_getfund,
      v_item_vat,
      v_item_tax,
      coalesce(v_product.tax_treatment, 'standard')
    );

    update public.products
    set quantity = quantity - v_quantity
    where id = v_product.id
      and business_id = p_business_id
    returning * into v_updated_product;

    v_updated_products := v_updated_products || jsonb_build_array(to_jsonb(v_updated_product));
  end loop;

  if p_amount_paid is not null then
    v_amount_paid := greatest(0, least(v_grand_total, p_amount_paid));
  elsif p_payment_method = 'credit' then
    v_amount_paid := 0;
  else
    v_amount_paid := v_grand_total;
  end if;

  if v_amount_paid < v_grand_total and v_customer_id is null then
    raise exception 'Sales with an unpaid balance require a customer.' using errcode = '23514';
  end if;

  update public.sales
  set subtotal = v_subtotal_ex_tax,
      total = v_grand_total,
      amount_paid = v_amount_paid,
      subtotal_ex_tax = v_subtotal_ex_tax,
      total_nhil = v_total_nhil,
      total_getfund = v_total_getfund,
      total_vat = v_total_vat,
      total_tax = v_total_tax
  where id = v_sale_id
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'customer', v_customer_json,
    'updated_products', v_updated_products
  );
end;
$$;

grant execute on function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, uuid, uuid) to anon, authenticated;
