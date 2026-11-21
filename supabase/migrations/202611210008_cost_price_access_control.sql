-- Protect wholesale product and sale costs at the database boundary.
-- Members can read operational product fields; only managers can read costs.
revoke select on public.products from public, anon, authenticated;
grant select (
  id, business_id, name, category, sku, selling_price, quantity,
  low_stock_limit, supplier, size, colour, brand, item_type, tax_treatment,
  created_at, updated_at
) on public.products to authenticated;

revoke insert, update on public.products from public, anon, authenticated;
grant insert (
  business_id, name, category, sku, selling_price, quantity, low_stock_limit,
  supplier, size, colour, brand, item_type, tax_treatment
) on public.products to authenticated;
grant update (
  name, category, sku, selling_price, quantity, low_stock_limit, supplier,
  size, colour, brand, item_type, tax_treatment, updated_at
) on public.products to authenticated;

drop policy if exists "Members can add products" on public.products;
drop policy if exists "Members can update products" on public.products;
drop policy if exists "Managers can add products" on public.products;
drop policy if exists "Managers can update products" on public.products;
create policy "Managers can add products" on public.products
  for insert to authenticated with check (public.can_manage_business(business_id));
create policy "Managers can update products" on public.products
  for update to authenticated using (public.can_manage_business(business_id))
  with check (public.can_manage_business(business_id));

-- Sale item cost is never returned through ordinary PostgREST reads.
revoke select on public.sale_items from public, anon, authenticated;
grant select (
  id, sale_id, product_id, product_name, quantity, unit_price, line_total,
  created_at, tax_treatment_snapshot, taxable_amount, nhil_amount,
  getfund_amount, vat_amount, total_tax
) on public.sale_items to authenticated;

-- The inventory ledger also contains historical wholesale prices.
revoke all on public.product_restocks from public, anon, authenticated;
create or replace function public.list_manager_product_restocks(
  p_business_id uuid,
  p_product_id uuid
)
returns setof public.product_restocks
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to view restock costs.' using errcode = '42501';
  end if;
  return query
  select r.* from public.product_restocks r
  where r.business_id = p_business_id and r.product_id = p_product_id
  order by r.created_at desc;
end;
$$;
revoke all on function public.list_manager_product_restocks(uuid, uuid) from public;
grant execute on function public.list_manager_product_restocks(uuid, uuid) to authenticated;

create or replace function public.list_manager_products(
  p_business_id uuid,
  p_product_id uuid default null,
  p_category text default null,
  p_search text default null,
  p_offset integer default 0,
  p_limit integer default 1000
)
returns setof public.products
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to view product costs.' using errcode = '42501';
  end if;
  return query
  select p.* from public.products p
  where p.business_id = p_business_id
    and (p_product_id is null or p.id = p_product_id)
    and (p_category is null or p.category = trim(p_category))
    and (p_search is null or p.name ilike ('%' || trim(p_search) || '%')
      or p.sku ilike ('%' || trim(p_search) || '%')
      or p.brand ilike ('%' || trim(p_search) || '%'))
  order by p.name
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 1000), 1), 5000);
end;
$$;
revoke all on function public.list_manager_products(uuid, uuid, text, text, integer, integer) from public;
grant execute on function public.list_manager_products(uuid, uuid, text, text, integer, integer) to authenticated;

create or replace function public.save_manager_product(
  p_business_id uuid,
  p_product_id uuid default null,
  p_product jsonb default '{}'::jsonb
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  if not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to change inventory.' using errcode = '42501';
  end if;
  if p_product_id is null then
    insert into public.products (
      business_id, name, category, sku, cost_price, selling_price, quantity,
      low_stock_limit, supplier, size, colour, brand, item_type, tax_treatment
    ) values (
      p_business_id, trim(p_product->>'name'), nullif(trim(p_product->>'category'), ''),
      nullif(trim(p_product->>'sku'), ''), coalesce(nullif(p_product->>'cost_price', '')::numeric, 0),
      coalesce(nullif(p_product->>'selling_price', '')::numeric, 0), coalesce(nullif(p_product->>'quantity', '')::integer, 0),
      coalesce(nullif(p_product->>'low_stock_limit', '')::integer, 0), nullif(trim(p_product->>'supplier'), ''),
      nullif(trim(p_product->>'size'), ''), nullif(trim(p_product->>'colour'), ''),
      nullif(trim(p_product->>'brand'), ''), nullif(trim(p_product->>'item_type'), ''),
      coalesce(nullif(p_product->>'tax_treatment', ''), 'standard')
    ) returning * into v_product;
  else
    update public.products p set
      name = trim(p_product->>'name'), category = nullif(trim(p_product->>'category'), ''),
      sku = nullif(trim(p_product->>'sku'), ''),
      cost_price = coalesce(nullif(p_product->>'cost_price', '')::numeric, p.cost_price),
      selling_price = coalesce(nullif(p_product->>'selling_price', '')::numeric, p.selling_price),
      quantity = coalesce(nullif(p_product->>'quantity', '')::integer, p.quantity),
      low_stock_limit = coalesce(nullif(p_product->>'low_stock_limit', '')::integer, p.low_stock_limit),
      supplier = nullif(trim(p_product->>'supplier'), ''), size = nullif(trim(p_product->>'size'), ''),
      colour = nullif(trim(p_product->>'colour'), ''), brand = nullif(trim(p_product->>'brand'), ''),
      item_type = nullif(trim(p_product->>'item_type'), ''),
      tax_treatment = coalesce(nullif(p_product->>'tax_treatment', ''), 'standard'), updated_at = now()
    where p.id = p_product_id and p.business_id = p_business_id
    returning p.* into v_product;
    if not found then
      raise exception 'Product was not found in this business.' using errcode = 'P0002';
    end if;
  end if;
  return v_product;
end;
$$;
revoke all on function public.save_manager_product(uuid, uuid, jsonb) from public;
grant execute on function public.save_manager_product(uuid, uuid, jsonb) to authenticated;

create or replace function public.get_business_profit(
  p_business_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare v_profit numeric(14,2);
begin
  if not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to view profit.' using errcode = '42501';
  end if;
  select coalesce(sum(si.line_total - coalesce(si.total_tax, 0) - si.unit_cost * si.quantity), 0)
  into v_profit
  from public.sales s join public.sale_items si on si.sale_id = s.id
  where s.business_id = p_business_id and s.sold_at >= p_start and s.sold_at < p_end;
  return v_profit;
end;
$$;
revoke all on function public.get_business_profit(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_business_profit(uuid, timestamptz, timestamptz) to authenticated;

-- Keep the existing transactional sale implementation, but remove cost fields from
-- its JSON response for cashiers and non-manager business members.
alter function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid)
  rename to record_sale_internal_cost_protected;
revoke all on function public.record_sale_internal_cost_protected(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid)
  from public, anon, authenticated;

create function public.record_sale(
  p_business_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_notes text default null,
  p_amount_paid numeric default null,
  p_due_date date default null,
  p_session_token text default null,
  p_client_sale_id uuid default null,
  p_staff_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_products jsonb;
  v_business_id uuid;
begin
  v_result := public.record_sale_internal_cost_protected(
    p_business_id, p_payment_method, p_items, p_customer_id, p_customer_name,
    p_customer_phone, p_notes, p_amount_paid, p_due_date, p_session_token,
    p_client_sale_id, p_staff_account_id
  );
  v_business_id := (v_result->'sale'->>'business_id')::uuid;
  if auth.uid() is not null and public.can_manage_business(v_business_id) then
    return v_result;
  end if;
  select coalesce(jsonb_agg(item - 'cost_price'), '[]'::jsonb)
  into v_products
  from jsonb_array_elements(coalesce(v_result->'updated_products', '[]'::jsonb)) as elements(item);
  return jsonb_build_object(
    'sale', v_result->'sale',
    'customer', v_result->'customer',
    'updated_products', v_products
  );
end;
$$;
revoke all on function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid)
  from public;
grant execute on function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid)
  to anon, authenticated;
