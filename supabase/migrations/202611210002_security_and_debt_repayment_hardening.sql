-- Migration: Security, Multi-Tenant Isolation, Debt Repayment, and Staff Attribution Hardening
-- Description:
-- 1. Tightens RLS on billing_documents & billing_document_items (eliminates open anon access).
-- 2. Updates pay_debt RPC to allow counter cashiers (v_user_id is null) to collect debt repayments.
-- 3. Adds staff_account_id to sales table and updates record_sale RPC with staff attribution.
-- 4. Creates list_counter_products RPC which omits cost_price to prevent DevTools wholesale margin leaks.

-- 1. Tighten RLS on billing_documents & items
drop policy if exists "Members can read billing documents" on public.billing_documents;
create policy "Members can read billing documents"
on public.billing_documents for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "Members can insert billing documents" on public.billing_documents;
create policy "Members can insert billing documents"
on public.billing_documents for insert
to authenticated
with check (public.is_business_member(business_id));

drop policy if exists "Members can update billing documents" on public.billing_documents;
create policy "Members can update billing documents"
on public.billing_documents for update
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "Members can delete billing documents" on public.billing_documents;
drop policy if exists "Managers can delete billing documents" on public.billing_documents;
create policy "Managers can delete billing documents"
on public.billing_documents for delete
to authenticated
using (public.can_manage_business(business_id));

-- billing_document_items
drop policy if exists "Members can read billing document items" on public.billing_document_items;
create policy "Members can read billing document items"
on public.billing_document_items for select
to authenticated
using (
  exists (
    select 1 from public.billing_documents d
    where d.id = billing_document_items.document_id
      and public.is_business_member(d.business_id)
  )
);

drop policy if exists "Members can insert billing document items" on public.billing_document_items;
create policy "Members can insert billing document items"
on public.billing_document_items for insert
to authenticated
with check (
  exists (
    select 1 from public.billing_documents d
    where d.id = billing_document_items.document_id
      and public.is_business_member(d.business_id)
  )
);

drop policy if exists "Members can delete billing document items" on public.billing_document_items;
drop policy if exists "Managers can delete billing document items" on public.billing_document_items;
create policy "Managers can delete billing document items"
on public.billing_document_items for delete
to authenticated
using (
  exists (
    select 1 from public.billing_documents d
    where d.id = billing_document_items.document_id
      and public.can_manage_business(d.business_id)
  )
);

-- 2. Update pay_debt RPC to support counter cashiers
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

  -- Validate customer belongs to the specified business
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

    v_remaining := v_remaining - v_pay_amount;
    v_applied := v_applied + v_pay_amount;
  end loop;

  return v_applied;
end;
$$;

grant execute on function public.pay_debt(uuid, uuid, numeric, text) to anon, authenticated;

-- 3. Add staff_account_id to public.sales and update record_sale RPC
alter table public.sales
  add column if not exists staff_account_id uuid references public.staff_accounts(id) on delete set null;

create index if not exists sales_staff_account_id_idx on public.sales(staff_account_id);

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
  p_staff_account_id uuid default null
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
    due_date,
    staff_account_id
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
    p_staff_account_id
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
  date,
  uuid
) to anon, authenticated;

-- 4. Counter Catalog RPC (omits cost_price to protect wholesale margins over the wire)
create or replace function public.list_counter_products(
  p_business_id uuid,
  p_category text default null,
  p_search text default null
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
  if not exists (select 1 from public.businesses where id = p_business_id) then
    raise exception 'Invalid business.' using errcode = '42501';
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

grant execute on function public.list_counter_products(uuid, text, text) to anon, authenticated;
