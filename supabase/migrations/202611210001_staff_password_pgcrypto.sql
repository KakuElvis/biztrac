-- Migration: Upgrade Staff Password Storage to pgcrypto bcrypt
-- Description:
-- 1. Enables pgcrypto extension in extensions schema.
-- 2. Automatically hashes all staff passwords using Blowfish crypt with 8 salt rounds (extensions.crypt(password, extensions.gen_salt('bf', 8))).
-- 3. Adds BEFORE INSERT OR UPDATE trigger to automatically hash passwords whenever stored or updated.
-- 4. Creates secure RPC public.set_staff_password() for owners/managers to reset passwords.
-- 5. Updates public.authenticate_staff() RPC to verify bcrypt hashes with seamless backwards-compatible auto-migration.
-- 6. Tightens staff_accounts RLS by removing open anonymous select access (counter login uses authenticate_staff security definer).

-- Ensure search_path resolves extensions schema in all migration runners
set search_path = public, extensions;

-- 1. Enable pgcrypto extension in extensions schema
create extension if not exists pgcrypto with schema extensions;

-- 2. Trigger function to automatically hash new/updated staff passwords if not already hashed
create or replace function public.hash_staff_password_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.password_hash is not null and trim(new.password_hash) <> '' and new.password_hash not like '$2%' then
    new.password_hash := extensions.crypt(trim(new.password_hash), extensions.gen_salt('bf', 8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_staff_password on public.staff_accounts;
create trigger trg_hash_staff_password
before insert or update of password_hash on public.staff_accounts
for each row
execute function public.hash_staff_password_trigger();

-- 3. One-time upgrade of any existing plaintext passwords in staff_accounts
update public.staff_accounts
set password_hash = extensions.crypt(trim(password_hash), extensions.gen_salt('bf', 8)),
    updated_at = now()
where password_hash is not null
  and trim(password_hash) <> ''
  and password_hash not like '$2%';

-- 4. Secure RPC function for business owners/managers to set or reset a staff member's password
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
  -- Authorization check: Caller must have manager/owner rights in this business
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
    'message', 'Staff password updated successfully.'
  );
end;
$$;

grant execute on function public.set_staff_password(uuid, text, text) to authenticated;

-- 5. Updated authenticate_staff RPC supporting pgcrypto bcrypt with backwards-compatible auto-upgrade
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
begin
  select * into v_staff
  from public.staff_accounts
  where upper(trim(staff_id)) = upper(trim(p_staff_id))
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Staff ID not found. Please verify with your store owner.');
  end if;

  -- Validate password using crypt() for bcrypt hashes, or direct comparison for legacy plaintext
  if v_staff.password_hash like '$2%' then
    v_password_valid := (extensions.crypt(trim(p_password), v_staff.password_hash) = v_staff.password_hash);
  else
    v_password_valid := (v_staff.password_hash = trim(p_password));
    -- Transparently auto-upgrade legacy plaintext password to pgcrypto bcrypt
    if v_password_valid then
      update public.staff_accounts
      set password_hash = extensions.crypt(trim(p_password), extensions.gen_salt('bf', 8)),
          updated_at = now()
      where id = v_staff.id;
    end if;
  end if;

  if not v_password_valid then
    return jsonb_build_object('success', false, 'error', 'Incorrect password. Please try again.');
  end if;

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
      'slogan', coalesce(v_biz.slogan, ''),
      'momo_details', coalesce(v_biz.momo_details, ''),
      'return_policy', coalesce(v_biz.return_policy, 'Goods sold in good condition are not returnable after 3 days.'),
      'receipt_width', coalesce(v_biz.receipt_width, '58mm'),
      'receipt_footer', coalesce(v_biz.receipt_footer, 'Thank you for your patronage! Visit again.'),
      'vat_enabled', coalesce(v_biz.vat_enabled, false),
      'tin_number', coalesce(v_biz.tin_number, ''),
      'tax_pricing_mode', coalesce(v_biz.tax_pricing_mode, 'exclusive'),
      'vat_rate', coalesce(v_biz.vat_rate, 15.00),
      'nhil_rate', coalesce(v_biz.nhil_rate, 2.50),
      'getfund_rate', coalesce(v_biz.getfund_rate, 2.50)
    )
  );
end;
$$;

grant execute on function public.authenticate_staff(text, text) to anon, authenticated;

-- 6. Tighten RLS: drop open anonymous lookup policy on staff_accounts if it exists
-- Unauthenticated cashiers authenticate via authenticate_staff RPC (security definer)
drop policy if exists "Allow staff login lookup" on public.staff_accounts;
