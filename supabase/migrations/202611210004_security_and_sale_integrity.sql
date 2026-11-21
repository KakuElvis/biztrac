-- Security and consistency remediation: remove anonymous tenant access and restore audited sale snapshots.
-- Ensure the aggregate view runs with caller privileges so underlying RLS filters each tenant.
create or replace view public.customer_balances with (security_invoker = true) as
select s.business_id, s.customer_id, c.name as customer_name, c.phone as customer_phone,
       sum(s.total - s.amount_paid) as total_debt, count(s.id) as unpaid_sales_count,
       max(s.sold_at) as latest_sale_at
from public.sales s left join public.customers c on c.id = s.customer_id
where s.total > s.amount_paid
  and s.debt_status = 'active'
group by s.business_id, s.customer_id, c.name, c.phone;
revoke all on public.customer_balances from anon, public;
grant select on public.customer_balances to authenticated;

-- Composite index to accelerate customer debt and sales queries
create index if not exists sales_business_customer_idx
  on public.sales(business_id, customer_id);

-- Existing browser-only cashier sessions are not database-authenticated. Fail closed for public table access.
drop policy if exists "Members and counter staff can read products" on public.products;
drop policy if exists "Members can read products" on public.products;
drop policy if exists "Members and counter staff can read product categories" on public.product_categories;
drop policy if exists "Members can read product categories" on public.product_categories;
drop policy if exists "Members and counter staff can read customers" on public.customers;
drop policy if exists "Members can read customers" on public.customers;
drop policy if exists "Counter staff can create customers" on public.customers;
drop policy if exists "Members can add customers" on public.customers;
drop policy if exists "Members can create customers" on public.customers;
drop policy if exists "Members and counter staff can read sales" on public.sales;
drop policy if exists "Members can read sales" on public.sales;
drop policy if exists "Members and counter staff can read sale items" on public.sale_items;

create policy "Members can read products" on public.products for select to authenticated using (public.is_business_member(business_id));
create policy "Members can read product categories" on public.product_categories for select to authenticated using (public.is_business_member(business_id));
create policy "Members can read customers" on public.customers for select to authenticated using (public.is_business_member(business_id));
create policy "Members can create customers" on public.customers for insert to authenticated with check (public.is_business_member(business_id));
create policy "Members can read sales" on public.sales for select to authenticated using (public.is_business_member(business_id));
drop policy if exists "Members can read sale items" on public.sale_items;
create policy "Members can read sale items" on public.sale_items for select to authenticated using (
  exists (select 1 from public.sales s where s.id = sale_items.sale_id and public.is_business_member(s.business_id))
);

drop function if exists public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, uuid);
drop function if exists public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date);
alter table public.sales add column if not exists client_sale_id uuid;
create unique index if not exists sales_business_client_sale_id_uidx on public.sales(business_id, client_sale_id) where client_sale_id is not null;
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

  -- Tax variables
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

    -- Compute line taxes
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
      tax_treatment_snapshot,
      taxable_amount,
      nhil_amount,
      getfund_amount,
      vat_amount,
      total_tax
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.selling_price,
      v_product.cost_price,
      v_line_total,
      coalesce(v_product.tax_treatment, 'standard'),
      v_taxable_amount,
      v_item_nhil,
      v_item_getfund,
      v_item_vat,
      v_item_tax
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

-- Grant execute on record_sale to both authenticated and counter cashiers (anon)
grant execute on function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, uuid, uuid) to anon, authenticated;

-- Drop previous list_counter_products signatures to allow updated signature
drop function if exists public.list_counter_products(uuid, text, text, uuid);
drop function if exists public.list_counter_products(uuid, text, text);

create or replace function public.list_counter_products(
  p_business_id uuid,
  p_category text default null,
  p_search text default null,
  p_staff_account_id uuid default null
)
returns table (id uuid, business_id uuid, name text, category text, sku text, selling_price numeric, quantity integer, low_stock_limit integer, supplier text, size text, colour text, brand text, item_type text, tax_treatment text)
language plpgsql security definer set search_path = '' as $$
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

  return query select p.id, p.business_id, p.name, coalesce(p.category, ''), coalesce(p.sku, ''), p.selling_price, p.quantity, p.low_stock_limit, coalesce(p.supplier, ''), coalesce(p.size, ''), coalesce(p.colour, ''), coalesce(p.brand, ''), coalesce(p.item_type, ''), coalesce(p.tax_treatment, 'standard')
  from public.products p where p.business_id = p_business_id
    and (p_category is null or p.category = trim(p_category))
    and (p_search is null or p.name ilike ('%' || trim(p_search) || '%') or p.sku ilike ('%' || trim(p_search) || '%') or p.brand ilike ('%' || trim(p_search) || '%'))
  order by p.name;
end;
$$;

grant execute on function public.list_counter_products(uuid, text, text, uuid) to anon, authenticated;

-- 5. Audit Table: debt_payments for Cash Drawer Balancing & Shift Tracking
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

create index if not exists debt_payments_business_created_at_idx on public.debt_payments(business_id, created_at desc);
create index if not exists debt_payments_customer_idx on public.debt_payments(customer_id);

alter table public.debt_payments enable row level security;
drop policy if exists "Members can read debt payments" on public.debt_payments;
create policy "Members can read debt payments" on public.debt_payments for select to authenticated using (public.is_business_member(business_id));

-- Drop previous pay_debt signatures to allow updated signature with staff attribution
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

-- Billing records also contained public policies in the original invoice migration.
drop policy if exists "Members can read billing documents" on public.billing_documents;
drop policy if exists "Members can insert billing documents" on public.billing_documents;
drop policy if exists "Members can update billing documents" on public.billing_documents;
drop policy if exists "Members can delete billing documents" on public.billing_documents;
drop policy if exists "Managers can delete billing documents" on public.billing_documents;
drop policy if exists "Members can read billing document items" on public.billing_document_items;
drop policy if exists "Members can insert billing document items" on public.billing_document_items;
drop policy if exists "Members can delete billing document items" on public.billing_document_items;
drop policy if exists "Managers can delete billing document items" on public.billing_document_items;
create policy "Members can read billing documents" on public.billing_documents for select to authenticated using (public.is_business_member(business_id));
create policy "Members can insert billing documents" on public.billing_documents for insert to authenticated with check (public.is_business_member(business_id));
create policy "Members can update billing documents" on public.billing_documents for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Managers can delete billing documents" on public.billing_documents for delete to authenticated using (public.can_manage_business(business_id));
create policy "Members can read billing document items" on public.billing_document_items for select to authenticated using (
  exists (select 1 from public.billing_documents d where d.id = billing_document_items.document_id and public.is_business_member(d.business_id))
);
create policy "Members can insert billing document items" on public.billing_document_items for insert to authenticated with check (
  exists (select 1 from public.billing_documents d where d.id = billing_document_items.document_id and public.is_business_member(d.business_id))
);
create policy "Members can delete billing document items" on public.billing_document_items for delete to authenticated using (
  exists (select 1 from public.billing_documents d where d.id = billing_document_items.document_id and public.is_business_member(d.business_id))
);

create or replace function public.save_billing_document(p_business_id uuid, p_document_id uuid, p_document jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id) then
    raise exception 'A signed-in business member is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one invoice line item is required.';
  end if;
  if p_document_id is null then
    insert into public.billing_documents (
      business_id, doc_number, doc_type, status, customer_name, customer_phone, customer_email,
      customer_address, issue_date, due_date, subtotal, discount_amount, tax_rate, tax_amount,
      total_amount, payment_terms, bank_momo_details, notes, updated_at
    ) values (
      p_business_id, p_document->>'doc_number', p_document->>'doc_type', coalesce(p_document->>'status','draft'),
      p_document->>'customer_name', p_document->>'customer_phone', p_document->>'customer_email',
      p_document->>'customer_address', (p_document->>'issue_date')::date, nullif(p_document->>'due_date','')::date,
      coalesce((p_document->>'subtotal')::numeric,0), coalesce((p_document->>'discount_amount')::numeric,0),
      coalesce((p_document->>'tax_rate')::numeric,0), coalesce((p_document->>'tax_amount')::numeric,0),
      coalesce((p_document->>'total_amount')::numeric,0), p_document->>'payment_terms',
      p_document->>'bank_momo_details', p_document->>'notes', now()
    ) returning id into v_id;
  else
    update public.billing_documents set
      doc_number=p_document->>'doc_number', doc_type=p_document->>'doc_type', status=coalesce(p_document->>'status','draft'),
      customer_name=p_document->>'customer_name', customer_phone=p_document->>'customer_phone',
      customer_email=p_document->>'customer_email', customer_address=p_document->>'customer_address',
      issue_date=(p_document->>'issue_date')::date, due_date=nullif(p_document->>'due_date','')::date,
      subtotal=coalesce((p_document->>'subtotal')::numeric,0), discount_amount=coalesce((p_document->>'discount_amount')::numeric,0),
      tax_rate=coalesce((p_document->>'tax_rate')::numeric,0), tax_amount=coalesce((p_document->>'tax_amount')::numeric,0),
      total_amount=coalesce((p_document->>'total_amount')::numeric,0), payment_terms=p_document->>'payment_terms',
      bank_momo_details=p_document->>'bank_momo_details', notes=p_document->>'notes', updated_at=now()
    where id=p_document_id and business_id=p_business_id returning id into v_id;
    if v_id is null then raise exception 'Invoice was not found in this business.' using errcode = 'P0002'; end if;
    delete from public.billing_document_items where document_id=v_id;
  end if;
  insert into public.billing_document_items(document_id,product_id,description,quantity,unit_price,line_total)
  select v_id, nullif(item->>'product_id','')::uuid, coalesce(nullif(item->>'description',''),'Item'),
         coalesce((item->>'quantity')::numeric,1), coalesce((item->>'unit_price')::numeric,0),
         coalesce((item->>'line_total')::numeric,0)
  from jsonb_array_elements(p_items) item;
  return v_id;
end;
$$;
revoke all on function public.save_billing_document(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_billing_document(uuid, uuid, jsonb, jsonb) to authenticated;
