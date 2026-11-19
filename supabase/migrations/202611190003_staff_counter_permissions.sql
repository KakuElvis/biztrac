-- Migration: Grant Counter Staff and Cashiers access to Products, Categories, Customers, and Sales
-- Description: Enables counter cashiers who sign in using Staff ID and Password to read the store's
-- product catalog, view customer debtors, and complete POS sales.

-- 1. Products: Allow counter staff and customers to read products for sales checkout
drop policy if exists "Members can read products" on public.products;
drop policy if exists "Members and counter staff can read products" on public.products;
create policy "Members and counter staff can read products"
on public.products for select
to anon, authenticated
using (business_id is not null);

-- 2. Product Categories: Allow counter staff to read categories to filter items
drop policy if exists "Members can read product categories" on public.product_categories;
drop policy if exists "Members and counter staff can read product categories" on public.product_categories;
create policy "Members and counter staff can read product categories"
on public.product_categories for select
to anon, authenticated
using (business_id is not null);

-- 3. Customers: Allow reading customers and creating new customers at checkout
drop policy if exists "Members can read customers" on public.customers;
drop policy if exists "Members and counter staff can read customers" on public.customers;
create policy "Members and counter staff can read customers"
on public.customers for select
to anon, authenticated
using (business_id is not null);

drop policy if exists "Counter staff can create customers" on public.customers;
create policy "Counter staff can create customers"
on public.customers for insert
to anon, authenticated
with check (business_id is not null);

-- 4. Customer Debtor Balances View
grant select on public.customer_balances to anon, authenticated;

-- 5. Sales & Sale Items: Allow reading sales and receipts at counter
drop policy if exists "Members can read sales" on public.sales;
drop policy if exists "Members and counter staff can read sales" on public.sales;
create policy "Members and counter staff can read sales"
on public.sales for select
to anon, authenticated
using (business_id is not null);

drop policy if exists "Members can read sale items" on public.sale_items;
drop policy if exists "Members and counter staff can read sale items" on public.sale_items;
create policy "Members and counter staff can read sale items"
on public.sale_items for select
to anon, authenticated
using (true);

-- 6. Update record_sale RPC: Permit counter staff and cashiers to record POS sales
create or replace function public.record_sale(
  p_business_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_notes text default null,
  p_amount_paid numeric default null,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale_id uuid := gen_random_uuid();
  v_reference text;
  v_customer_id uuid := p_customer_id;
  v_customer public.customers%rowtype;
  v_customer_json jsonb := null;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_amount_paid numeric(12, 2) := 0;
  v_updated_product public.products%rowtype;
  v_updated_products jsonb := '[]'::jsonb;
  v_sale public.sales%rowtype;
begin
  -- Validate store membership or valid business counter session
  if v_user_id is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'You are not a member of this business.' using errcode = '42501';
    end if;
  else
    if not exists (select 1 from public.businesses where id = p_business_id) then
      raise exception 'Store not found or invalid business.' using errcode = '42501';
    end if;
  end if;

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
    due_date
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
    p_due_date
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

    v_line_total := v_quantity * v_product.selling_price;
    v_subtotal := v_subtotal + v_line_total;

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      unit_cost,
      line_total
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.selling_price,
      v_product.cost_price,
      v_line_total
    );

    update public.products
    set quantity = quantity - v_quantity
    where id = v_product.id
      and business_id = p_business_id
    returning * into v_updated_product;

    v_updated_products := v_updated_products || jsonb_build_array(to_jsonb(v_updated_product));
  end loop;

  if p_amount_paid is not null then
    v_amount_paid := greatest(0, least(v_subtotal, p_amount_paid));
  elsif p_payment_method = 'credit' then
    v_amount_paid := 0;
  else
    v_amount_paid := v_subtotal;
  end if;

  update public.sales
  set subtotal = v_subtotal,
      total = v_subtotal,
      amount_paid = v_amount_paid
  where id = v_sale_id
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'customer', v_customer_json,
    'updated_products', v_updated_products
  );
end;
$$;

grant execute on function public.record_sale(
  uuid,
  text,
  jsonb,
  uuid,
  text,
  text,
  text,
  numeric,
  date
) to anon, authenticated;

-- 7. Update pay_debt RPC: Permit counter staff and cashiers to collect debt repayments
create or replace function public.pay_debt(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash'
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
    if not exists (select 1 from public.businesses where id = p_business_id) then
      raise exception 'Store not found or invalid business.' using errcode = '42501';
    end if;
  end if;

  -- Validate customer belongs to the specified business
  if not exists (
    select 1 from public.customers
    where id = p_customer_id and business_id = p_business_id
  ) then
    raise exception 'Customer does not belong to this business.' using errcode = '42501';
  end if;

  if p_amount <= 0 then
    raise exception 'Repayment amount must be greater than zero.';
  end if;

  -- Apply repayment chronologically across unpaid sales
  for v_sale in
    select id, total, amount_paid
    from public.sales
    where business_id = p_business_id
      and customer_id = p_customer_id
      and total > amount_paid
    order by sold_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_needed := v_sale.total - v_sale.amount_paid;
    v_pay_amount := least(v_needed, v_remaining);

    update public.sales
    set amount_paid = amount_paid + v_pay_amount
    where id = v_sale.id;

    v_remaining := v_remaining - v_pay_amount;
    v_applied := v_applied + v_pay_amount;
  end loop;

  return v_applied;
end;
$$;

grant execute on function public.pay_debt(
  uuid,
  uuid,
  numeric,
  text
) to anon, authenticated;
