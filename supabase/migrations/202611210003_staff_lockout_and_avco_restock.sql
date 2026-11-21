-- Migration: Staff Lockout Protection & Weighted Average Cost (AVCO) Restock
-- 1. Adds failed_login_attempts and locked_until to staff_accounts for brute-force PIN protection.
-- 2. Updates authenticate_staff to enforce 15-minute temporary lockout after 5 consecutive failed PIN attempts.
-- 3. Resets failed attempts on successful login, password update, or manual owner unlock.
-- 4. Introduces unlock_staff_account RPC for store owners and managers.
-- 5. Adds cost_method column to product_restocks and implements Weighted Average Cost (AVCO) calculation in restock_product.

-- Ensure search_path resolves extensions schema in all migration runners
set search_path = public, extensions;

-- ============================================================================
-- Step 1: Staff Account Lockout Schema Updates
-- ============================================================================
alter table public.staff_accounts
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz default null;

create index if not exists staff_accounts_locked_until_idx
  on public.staff_accounts(business_id, locked_until)
  where locked_until is not null;

-- ============================================================================
-- Step 2: Hardened authenticate_staff with Temporary Lockout Enforcement
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
  v_password_valid boolean := false;
  v_remaining_min integer;
  v_new_failed integer;
begin
  select * into v_staff
  from public.staff_accounts
  where upper(trim(staff_id)) = upper(trim(p_staff_id))
    and is_active = true;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Staff ID not found. Please verify with your store owner.'
    );
  end if;

  -- 1. Check if account is currently locked out
  if v_staff.locked_until is not null and v_staff.locked_until > clock_timestamp() then
    v_remaining_min := ceil(extract(epoch from (v_staff.locked_until - clock_timestamp())) / 60.0);
    return jsonb_build_object(
      'success', false,
      'error', 'Account is temporarily locked due to 5 consecutive failed PIN attempts. Try again in ' || v_remaining_min || ' minute(s), or ask your store owner to unlock your account.',
      'locked', true,
      'locked_until', v_staff.locked_until,
      'remaining_minutes', v_remaining_min
    );
  end if;

  -- 2. Validate password using crypt() for bcrypt hashes, or direct comparison for legacy plaintext
  if v_staff.password_hash like '$2%' then
    v_password_valid := (extensions.crypt(trim(p_password), v_staff.password_hash) = v_staff.password_hash);
  else
    v_password_valid := (v_staff.password_hash = trim(p_password));
  end if;

  -- 3. If password is INVALID, increment failure count and enforce lockout at 5 attempts
  if not v_password_valid then
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

  -- 4. If password is VALID, reset failed attempts & lockout, auto-upgrading legacy passwords
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

  return jsonb_build_object(
    'success', true,
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
-- Step 3: Update set_staff_password to Reset Failed Attempts on Password Reset
-- ============================================================================
create or replace function public.set_staff_password(
  p_business_id uuid,
  p_staff_id text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff_id text;
  v_clean_pass text;
begin
  if not public.can_manage_business(p_business_id) then
    return jsonb_build_object(
      'success', false,
      'error', 'Unauthorized. Only store owners and managers can reset staff passwords.'
    );
  end if;

  v_clean_pass := trim(p_new_password);
  if length(v_clean_pass) < 4 then
    return jsonb_build_object(
      'success', false,
      'error', 'Password must be at least 4 characters long.'
    );
  end if;

  update public.staff_accounts
  set password_hash = extensions.crypt(v_clean_pass, extensions.gen_salt('bf', 8)),
      failed_login_attempts = 0,
      locked_until = null,
      updated_at = now()
  where business_id = p_business_id
    and (
      upper(trim(staff_id)) = upper(trim(p_staff_id))
      or id::text = trim(p_staff_id)
    )
  returning staff_id into v_staff_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Staff member not found in this business.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'staff_id', v_staff_id,
    'message', 'Staff password updated and account unlocked successfully.'
  );
end;
$$;

grant execute on function public.set_staff_password(uuid, text, text) to authenticated;

-- ============================================================================
-- Step 4: Add unlock_staff_account RPC for Immediate Owner/Manager Unlock
-- ============================================================================
create or replace function public.unlock_staff_account(
  p_business_id uuid,
  p_staff_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_found_id text;
begin
  if not public.can_manage_business(p_business_id) then
    return jsonb_build_object(
      'success', false,
      'error', 'Unauthorized. Only store owners and managers can unlock staff accounts.'
    );
  end if;

  update public.staff_accounts
  set failed_login_attempts = 0,
      locked_until = null,
      updated_at = now()
  where business_id = p_business_id
    and (
      upper(trim(staff_id)) = upper(trim(p_staff_id))
      or id::text = trim(p_staff_id)
    )
  returning staff_id into v_found_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Staff member not found in this business.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'staff_id', v_found_id,
    'message', 'Staff account unlocked successfully.'
  );
end;
$$;

grant execute on function public.unlock_staff_account(uuid, text) to authenticated;

-- ============================================================================
-- Step 5: Weighted Average Cost (AVCO) Restock Support
-- ============================================================================
alter table public.product_restocks
  add column if not exists cost_method text not null default 'avco';

-- Drop the previous 7-parameter signature to prevent overloaded function ambiguity
drop function if exists public.restock_product(uuid, uuid, integer, numeric, numeric, text, text);

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

  -- Lock product row for atomic update
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

  -- Calculate effective unit cost:
  -- If new cost price is omitted/null, retain old cost.
  -- If method is 'latest' or previous quantity was <= 0, adopt the new shipment's unit cost.
  -- If method is 'avco' (Weighted Average Cost), blend old stock valuation with new shipment valuation.
  if p_new_cost_price is null then
    v_effective_cost := v_old_cost;
  elsif v_method = 'latest' or v_prev_qty <= 0 then
    v_effective_cost := round(p_new_cost_price, 2);
  else
    -- Weighted Average Cost: round(((old_qty * old_cost) + (added_qty * new_cost)) / total_qty, 2)
    v_effective_cost := round(
      ((v_prev_qty * v_old_cost) + (p_quantity_added * p_new_cost_price)) / v_new_qty,
      2
    );
  end if;

  -- Update product quantity and prices
  update public.products
  set
    quantity = v_new_qty,
    cost_price = v_effective_cost,
    selling_price = coalesce(p_new_selling_price, v_old_selling),
    updated_at = now()
  where id = p_product_id and business_id = p_business_id;

  -- Insert restock audit log
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
