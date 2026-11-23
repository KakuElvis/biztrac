-- Migration: 202611230003_super_admin_phase3.sql
-- Description:
-- 1. Granular Sub-Admin Roles (super_admin, billing, support) and get_admin_role() helper.
-- 2. Role-gated execution on admin_override_business_plan and admin_toggle_business_suspension.
-- 3. Merchant Impersonation audit & retrieval RPC (admin_impersonate_business).
-- 4. Platform System Announcements table and RPCs (broadcast maintenance/updates to POS).

set search_path = public, extensions;

-- ============================================================================
-- 1. Admin Role Discovery Helper
-- ============================================================================
create or replace function public.get_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select role from public.super_admins
    where user_id = auth.uid()
    limit 1
  ), 'none');
$$;

revoke all on function public.get_admin_role() from public, anon;
grant execute on function public.get_admin_role() to authenticated;

-- ============================================================================
-- 2. Role-Gated Subscription Plan Override
-- ============================================================================
create or replace function public.admin_override_business_plan(
  p_business_id uuid,
  p_plan_tier text,
  p_days_valid integer default 30,
  p_reason text default '',
  p_amount_paid numeric default 0.00
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.get_admin_role();
  v_new_expires timestamptz;
  v_biz public.businesses%rowtype;
  v_clean_tier text := lower(trim(p_plan_tier));
  v_amount numeric := coalesce(p_amount_paid, 0.00);
  v_momo_ref text;
  v_current_expiry timestamptz;
begin
  if v_role not in ('super_admin', 'billing') then
    raise exception 'Unauthorized: Plan overrides require super_admin or billing role' using errcode = '42501';
  end if;

  if v_clean_tier not in ('free', 'pro', 'enterprise') then
    raise exception 'Invalid plan tier: %', p_plan_tier using errcode = '22023';
  end if;

  select * into v_biz
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  v_current_expiry := v_biz.plan_expires_at;

  if v_clean_tier = 'free' then
    v_new_expires := null;
  else
    v_current_expiry := coalesce(
      case when v_current_expiry > clock_timestamp() then v_current_expiry else clock_timestamp() end,
      clock_timestamp()
    );
    v_new_expires := v_current_expiry + (greatest(coalesce(p_days_valid, 30), 1) || ' days')::interval;
  end if;

  -- 1. Update business subscription
  update public.businesses
  set
    plan_tier = v_clean_tier,
    plan_expires_at = v_new_expires,
    updated_at = clock_timestamp()
  where id = p_business_id;

  -- 2. Record manual MoMo / Cash collection
  if v_amount > 0 then
    v_momo_ref := 'MOMO-ADMIN-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 8);

    insert into public.subscription_payments (
      business_id,
      amount,
      currency,
      payment_method,
      paystack_reference,
      status,
      paid_at,
      metadata
    ) values (
      p_business_id,
      v_amount,
      coalesce(v_biz.currency, 'GHS'),
      'momo_admin_manual',
      v_momo_ref,
      'success',
      clock_timestamp(),
      jsonb_build_object(
        'recorded_by', auth.uid(),
        'plan_tier', v_clean_tier,
        'days_valid', p_days_valid,
        'note', p_reason
      )
    );
  end if;

  -- 3. Immutable audit entry
  insert into public.admin_audit_logs (
    admin_id,
    target_business_id,
    action,
    metadata
  ) values (
    auth.uid(),
    p_business_id,
    'MANUAL_PLAN_OVERRIDE',
    jsonb_build_object(
      'previous_tier', v_biz.plan_tier,
      'new_tier', v_clean_tier,
      'days_added', p_days_valid,
      'amount_paid', v_amount,
      'new_expires_at', v_new_expires,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'success', true,
    'business_id', p_business_id,
    'plan_tier', v_clean_tier,
    'plan_expires_at', v_new_expires,
    'amount_paid', v_amount,
    'is_pro', (v_clean_tier in ('pro', 'enterprise') and (v_new_expires is null or v_new_expires > clock_timestamp()))
  );
end;
$$;

revoke all on function public.admin_override_business_plan(uuid, text, integer, text, numeric) from public, anon;
grant execute on function public.admin_override_business_plan(uuid, text, integer, text, numeric) to authenticated;

-- ============================================================================
-- 3. Role-Gated Business Suspension Toggle
-- ============================================================================
create or replace function public.admin_toggle_business_suspension(
  p_business_id uuid,
  p_suspend boolean,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.get_admin_role();
  v_biz public.businesses%rowtype;
  v_action text;
begin
  if v_role not in ('super_admin', 'support') then
    raise exception 'Unauthorized: Account suspensions require super_admin or support role' using errcode = '42501';
  end if;

  select * into v_biz
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  update public.businesses
  set
    is_suspended = coalesce(p_suspend, false),
    suspended_at = case when coalesce(p_suspend, false) then clock_timestamp() else null end,
    suspension_reason = case when coalesce(p_suspend, false) then nullif(trim(p_reason), '') else null end,
    updated_at = clock_timestamp()
  where id = p_business_id;

  v_action := case when p_suspend then 'SUSPEND_STORE' else 'REACTIVATE_STORE' end;

  insert into public.admin_audit_logs (
    admin_id,
    target_business_id,
    action,
    metadata
  ) values (
    auth.uid(),
    p_business_id,
    v_action,
    jsonb_build_object(
      'is_suspended', p_suspend,
      'reason', trim(p_reason),
      'toggled_at', clock_timestamp()
    )
  );

  return jsonb_build_object(
    'success', true,
    'business_id', p_business_id,
    'is_suspended', coalesce(p_suspend, false),
    'suspended_at', case when coalesce(p_suspend, false) then clock_timestamp() else null end,
    'suspension_reason', case when coalesce(p_suspend, false) then trim(p_reason) else null end
  );
end;
$$;

revoke all on function public.admin_toggle_business_suspension(uuid, boolean, text) from public, anon;
grant execute on function public.admin_toggle_business_suspension(uuid, boolean, text) to authenticated;

-- ============================================================================
-- 4. Merchant Impersonation Audit & Retrieval
-- ============================================================================
create or replace function public.admin_impersonate_business(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.get_admin_role();
  v_biz record;
begin
  if v_role not in ('super_admin', 'support') then
    raise exception 'Unauthorized: Impersonation requires super_admin or support role' using errcode = '42501';
  end if;

  select
    b.id,
    b.name,
    b.currency,
    b.location,
    b.phone,
    b.email,
    b.plan_tier,
    b.plan_expires_at,
    b.is_suspended,
    b.created_at,
    coalesce(p.full_name, 'Store Owner') as owner_name,
    coalesce(u.email::text, b.email, '') as owner_email
  into v_biz
  from public.businesses b
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id
  where b.id = p_business_id;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_logs (
    admin_id,
    target_business_id,
    action,
    metadata
  ) values (
    auth.uid(),
    p_business_id,
    'IMPERSONATE_STORE',
    jsonb_build_object(
      'store_name', v_biz.name,
      'impersonated_at', clock_timestamp()
    )
  );

  return jsonb_build_object(
    'success', true,
    'business', row_to_json(v_biz)
  );
end;
$$;

revoke all on function public.admin_impersonate_business(uuid) from public, anon;
grant execute on function public.admin_impersonate_business(uuid) to authenticated;

-- ============================================================================
-- 5. Platform System Announcements
-- ============================================================================
create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'critical')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz default null
);

create index if not exists idx_system_announcements_active
  on public.system_announcements(is_active, created_at desc);

alter table public.system_announcements enable row level security;

drop policy if exists "Anyone can read active announcements" on public.system_announcements;
create policy "Anyone can read active announcements"
  on public.system_announcements for select
  to authenticated, anon
  using (is_active = true and (expires_at is null or expires_at > clock_timestamp()));

drop policy if exists "Super admins manage announcements" on public.system_announcements;
create policy "Super admins manage announcements"
  on public.system_announcements for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.admin_create_announcement(
  p_title text,
  p_message text,
  p_level text default 'info',
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.get_admin_role();
  v_new_id uuid;
begin
  if v_role not in ('super_admin') then
    raise exception 'Unauthorized: Only super_admin can broadcast announcements' using errcode = '42501';
  end if;

  insert into public.system_announcements (
    title,
    message,
    level,
    is_active,
    created_by,
    created_at,
    expires_at
  ) values (
    trim(p_title),
    trim(p_message),
    case when p_level in ('info', 'warning', 'critical') then p_level else 'info' end,
    true,
    auth.uid(),
    clock_timestamp(),
    p_expires_at
  ) returning id into v_new_id;

  insert into public.admin_audit_logs (
    admin_id,
    target_business_id,
    action,
    metadata
  ) values (
    auth.uid(),
    null,
    'CREATE_ANNOUNCEMENT',
    jsonb_build_object(
      'announcement_id', v_new_id,
      'title', p_title,
      'level', p_level
    )
  );

  return jsonb_build_object('success', true, 'id', v_new_id);
end;
$$;

create or replace function public.admin_toggle_announcement(
  p_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.get_admin_role();
begin
  if v_role not in ('super_admin') then
    raise exception 'Unauthorized: Only super_admin can modify announcements' using errcode = '42501';
  end if;

  update public.system_announcements
  set is_active = coalesce(p_is_active, false)
  where id = p_id;

  return jsonb_build_object('success', true, 'id', p_id, 'is_active', p_is_active);
end;
$$;

create or replace function public.admin_list_announcements()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'message', a.message,
        'level', a.level,
        'is_active', a.is_active,
        'created_at', a.created_at,
        'expires_at', a.expires_at
      ) order by a.created_at desc
    ),
    '[]'::jsonb
  ) into v_items
  from public.system_announcements a;

  return v_items;
end;
$$;

create or replace function public.get_active_announcements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'message', a.message,
        'level', a.level,
        'created_at', a.created_at,
        'expires_at', a.expires_at
      ) order by a.created_at desc
    ),
    '[]'::jsonb
  )
  from public.system_announcements a
  where a.is_active = true
    and (a.expires_at is null or a.expires_at > clock_timestamp());
$$;

revoke all on function public.admin_create_announcement(text, text, text, timestamptz) from public, anon;
grant execute on function public.admin_create_announcement(text, text, text, timestamptz) to authenticated;

revoke all on function public.admin_toggle_announcement(uuid, boolean) from public, anon;
grant execute on function public.admin_toggle_announcement(uuid, boolean) to authenticated;

revoke all on function public.admin_list_announcements() from public, anon;
grant execute on function public.admin_list_announcements() to authenticated;

revoke all on function public.get_active_announcements() from public;
grant execute on function public.get_active_announcements() to anon, authenticated;
