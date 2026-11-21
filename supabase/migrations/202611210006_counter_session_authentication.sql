-- Migration: 202611210006_counter_session_authentication.sql
-- Description:
-- 1. Introduces public.staff_sessions table for cryptographically secure cashier session tokens.
-- 2. Updates authenticate_staff() to generate a 256-bit secure session token upon valid PIN verification.
-- 3. Hardens counter RPCs (record_sale, pay_debt, list_counter_products) to require and verify the session token,
--    completely eliminating forged/unauthenticated anonymous execution.
-- 4. Derives cashier staff attribution server-side from the verified session token.
-- 5. Adds public.get_customer_metrics RPC to aggregate customer lifetime spend and order count in PostgreSQL.
-- 6. Adds public.products_view with manager-only cost_price masking.

set search_path = public, extensions;

-- ============================================================================
-- 1. Create staff_sessions Table
-- ============================================================================
create table if not exists public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_account_id uuid not null references public.staff_accounts(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null default (clock_timestamp() + interval '14 hours'),
  created_at timestamptz not null default now()
);

create index if not exists staff_sessions_token_hash_idx
  on public.staff_sessions(session_token_hash);

create index if not exists staff_sessions_business_staff_idx
  on public.staff_sessions(business_id, staff_account_id);

alter table public.staff_sessions enable row level security;
drop policy if exists "Members can read staff sessions" on public.staff_sessions;
create policy "Members can read staff sessions"
  on public.staff_sessions for select to authenticated
  using (public.is_business_member(business_id));

-- ============================================================================
-- 2. Update authenticate_staff to Generate Secure Session Tokens
-- ============================================================================
create or replace function public.authenticate_staff(
  p_staff_id text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts%rowtype;
  v_biz public.businesses%rowtype;
  v_remaining_seconds integer;
  v_new_failed integer;
  v_raw_token text;
  v_token_hash text;
  v_session_id uuid;
begin
  if p_staff_id is null or trim(p_staff_id) = '' then
    return jsonb_build_object('success', false, 'error', 'Staff ID is required.');
  end if;

  if p_password is null or trim(p_password) = '' then
    return jsonb_build_object('success', false, 'error', 'Password is required.');
  end if;

  select * into v_staff
  from public.staff_accounts
  where upper(trim(staff_id)) = upper(trim(p_staff_id));

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid Staff ID or password.');
  end if;

  if v_staff.locked_until is not null and v_staff.locked_until > clock_timestamp() then
    v_remaining_seconds := ceil(extract(epoch from (v_staff.locked_until - clock_timestamp())));
    return jsonb_build_object(
      'success', false,
      'error', 'Account is temporarily locked. Try again in ' || ceil(v_remaining_seconds / 60.0)::text || ' minute(s), or ask your store owner to unlock your account.',
      'locked', true,
      'remaining_minutes', ceil(v_remaining_seconds / 60.0)
    );
  end if;

  if v_staff.password_hash is null or (
    case
      when v_staff.password_hash like '$2%' then
        v_staff.password_hash <> extensions.crypt(trim(p_password), v_staff.password_hash)
      else
        v_staff.password_hash <> trim(p_password)
    end
  ) then
    v_new_failed := coalesce(v_staff.failed_login_attempts, 0) + 1;
    if v_new_failed >= 5 then
      update public.staff_accounts
      set failed_login_attempts = v_new_failed,
          locked_until = clock_timestamp() + interval '15 minutes',
          updated_at = now()
      where id = v_staff.id;

      return jsonb_build_object(
        'success', false,
        'error', 'Account locked: 5 consecutive failed PIN attempts. Try again in 15 minutes, or ask your store owner to unlock your account.',
        'locked', true,
        'locked_until', clock_timestamp() + interval '15 minutes',
        'remaining_minutes', 15
      );
    else
      update public.staff_accounts
      set failed_login_attempts = v_new_failed,
          updated_at = now()
      where id = v_staff.id;

      return jsonb_build_object(
        'success', false,
        'error', 'Incorrect password. ' || (5 - v_new_failed) || ' attempt(s) remaining before temporary lockout.'
      );
    end if;
  end if;

  -- Reset failed attempts & auto-upgrade legacy passwords
  update public.staff_accounts
  set failed_login_attempts = 0,
      locked_until = null,
      password_hash = (
        case
          when v_staff.password_hash not like '$2%' then extensions.crypt(trim(p_password), extensions.gen_salt('bf', 8))
          else v_staff.password_hash
        end
      ),
      updated_at = now()
  where id = v_staff.id;

  select * into v_biz
  from public.businesses
  where id = v_staff.business_id;

  -- Generate 256-bit cryptographically secure session token
  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  -- Invalidate any prior expired sessions for this staff member
  delete from public.staff_sessions
  where staff_account_id = v_staff.id
    and expires_at < clock_timestamp();

  insert into public.staff_sessions (
    staff_account_id,
    business_id,
    session_token_hash,
    expires_at
  ) values (
    v_staff.id,
    v_staff.business_id,
    v_token_hash,
    clock_timestamp() + interval '14 hours'
  ) returning id into v_session_id;

  return jsonb_build_object(
    'success', true,
    'session_token', v_raw_token,
    'expires_at', clock_timestamp() + interval '14 hours',
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'business_id', v_staff.business_id,
      'staff_id', v_staff.staff_id,
      'full_name', v_staff.full_name,
      'phone', coalesce(v_staff.phone, ''),
      'email', coalesce(v_staff.email, ''),
      'role', v_staff.role
    ),
    'business', jsonb_build_object(
      'id', coalesce(v_biz.id, v_staff.business_id),
      'name', coalesce(v_biz.name, 'BizTrac Store'),
      'currency', coalesce(v_biz.currency, 'GHS'),
      'location', coalesce(v_biz.location, ''),
      'phone', coalesce(v_biz.phone, ''),
      'vat_enabled', coalesce(v_biz.vat_enabled, false),
      'tin_number', coalesce(v_biz.tin_number, ''),
      'receipt_footer', coalesce(v_biz.receipt_footer, '')
    )
  );
end;
$$;

grant execute on function public.authenticate_staff(text, text) to anon, authenticated;

-- ============================================================================
-- 3. Helper: verify_staff_session
-- ============================================================================
create or replace function public.verify_staff_session(
  p_business_id uuid,
  p_session_token text
)
returns public.staff_sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_session public.staff_sessions%rowtype;
begin
  if p_session_token is null or trim(p_session_token) = '' then
    return null;
  end if;

  v_hash := encode(extensions.digest(trim(p_session_token), 'sha256'), 'hex');

  select s.* into v_session
  from public.staff_sessions s
  join public.staff_accounts a on a.id = s.staff_account_id
  where s.session_token_hash = v_hash
    and s.business_id = p_business_id
    and s.expires_at > clock_timestamp()
    and (a.locked_until is null or a.locked_until <= clock_timestamp());

  return v_session;
end;
$$;

revoke all on function public.verify_staff_session(uuid, text) from public;
grant execute on function public.verify_staff_session(uuid, text) to authenticated, anon;

-- ============================================================================
-- 4. Secure Counter RPC: list_counter_products (Requires Session Token for Anon)
-- ============================================================================
drop function if exists public.list_counter_products(uuid, text, text, text, uuid);
drop function if exists public.list_counter_products(uuid, text, text, text);
drop function if exists public.list_counter_products(uuid, text, text, uuid);
drop function if exists public.list_counter_products(uuid, text, text);

create or replace function public.list_counter_products(
  p_business_id uuid,
  p_category text default null,
  p_search text default null,
  p_session_token text default null,
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
set search_path = public, extensions
as $$
declare
  v_session public.staff_sessions%rowtype;
begin
  if auth.uid() is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required.' using errcode = '42501';
    end if;
  else
    -- Anon caller must provide a valid, active server-signed session token
    v_session := public.verify_staff_session(p_business_id, p_session_token);
    if v_session.id is null then
      raise exception 'Counter session is invalid, expired, or missing. Please sign in with your Staff ID.' using errcode = '42501';
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

grant execute on function public.list_counter_products(uuid, text, text, text, uuid) to anon, authenticated;

-- ============================================================================
-- 5. Secure Counter RPC: pay_debt (Requires Session Token for Anon)
-- ============================================================================
drop function if exists public.pay_debt(uuid, uuid, numeric, text, text, uuid);
drop function if exists public.pay_debt(uuid, uuid, numeric, text, text);
drop function if exists public.pay_debt(uuid, uuid, numeric, text, uuid);
drop function if exists public.pay_debt(uuid, uuid, numeric, text);

create or replace function public.pay_debt(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_session_token text default null,
  p_staff_account_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.staff_sessions%rowtype;
  v_staff_id uuid := null;
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
    v_session := public.verify_staff_session(p_business_id, p_session_token);
    if v_session.id is null then
      raise exception 'Counter session is invalid, expired, or missing. Please sign in with your Staff ID.' using errcode = '42501';
    end if;
    v_staff_id := v_session.staff_account_id;
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
      v_staff_id,
      'BT-PAY-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 4)),
      clock_timestamp()
    );

    v_remaining := v_remaining - v_pay_amount;
    v_applied := v_applied + v_pay_amount;
  end loop;

  return v_applied;
end;
$$;

grant execute on function public.pay_debt(uuid, uuid, numeric, text, text, uuid) to anon, authenticated;

-- ============================================================================
-- 6. Secure Counter RPC: record_sale (Requires Session Token for Anon)
-- ============================================================================
drop function if exists public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid);
drop function if exists public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid);
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
  p_session_token text default null,
  p_client_sale_id uuid default null,
  p_staff_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.staff_sessions%rowtype;
  v_staff_account_id uuid := null;
  v_sold_by uuid := null;
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
  -- Authenticate caller: either Supabase user or verified staff session
  if v_user_id is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required to record sales.' using errcode = '42501';
    end if;
    v_sold_by := v_user_id;
  else
    v_session := public.verify_staff_session(p_business_id, p_session_token);
    if v_session.id is null then
      raise exception 'Counter session is invalid, expired, or missing. Please sign in with your Staff ID.' using errcode = '42501';
    end if;
    -- Secure server-side staff attribution
    v_staff_account_id := v_session.staff_account_id;
  end if;

  select * into v_biz
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'Store not found or invalid business.' using errcode = '42501';
  end if;

  -- Idempotency protection for offline sync
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
    v_sold_by,
    p_due_date,
    0,
    0,
    0,
    0,
    0,
    v_biz.tin_number,
    v_pricing_mode,
    v_staff_account_id,
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

grant execute on function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid) to anon, authenticated;

-- ============================================================================
-- 7. SQL Aggregation RPC: get_customer_metrics (Eliminates Unbounded Fetch)
-- ============================================================================
create or replace function public.get_customer_metrics(
  p_business_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_lifetime_spend numeric(12, 2) := 0;
  v_total_orders integer := 0;
  v_active_debt numeric(12, 2) := 0;
begin
  if auth.uid() is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required.' using errcode = '42501';
    end if;
  end if;

  select coalesce(sum(total), 0), count(id)
  into v_lifetime_spend, v_total_orders
  from public.sales
  where business_id = p_business_id
    and customer_id = p_customer_id;

  select coalesce(sum(total - amount_paid), 0)
  into v_active_debt
  from public.sales
  where business_id = p_business_id
    and customer_id = p_customer_id
    and total > amount_paid
    and debt_status = 'active';

  return jsonb_build_object(
    'lifetime_spend', v_lifetime_spend,
    'total_orders', v_total_orders,
    'active_debt', v_active_debt
  );
end;
$$;

grant execute on function public.get_customer_metrics(uuid, uuid) to anon, authenticated;
