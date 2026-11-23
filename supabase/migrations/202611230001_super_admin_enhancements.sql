-- Migration: 202611230001_super_admin_enhancements.sql
-- Description:
-- 1. Adds performance index on public.sales(sold_at desc) to eliminate sequential scans on dashboard metrics.
-- 2. Adds composite indexes on public.businesses(plan_tier, plan_expires_at) and public.subscription_payments(status).
-- 3. Adds tenant suspension columns to public.businesses (is_suspended, suspended_at, suspension_reason).
-- 4. Updates public.admin_override_business_plan to accept p_amount_paid and record direct MoMo collections into public.subscription_payments.
-- 5. Introduces public.admin_toggle_business_suspension RPC for one-click store suspension and reactivation.
-- 6. Updates public.admin_list_businesses to return suspension data, support 'suspended' plan filter, and return total matching count.

set search_path = public, extensions;

-- ============================================================================
-- 1. Performance Indexes
-- ============================================================================
create index if not exists idx_sales_sold_at_desc
  on public.sales(sold_at desc);

create index if not exists idx_businesses_plan_status
  on public.businesses(plan_tier, plan_expires_at);

create index if not exists idx_sub_payments_status
  on public.subscription_payments(status);

-- ============================================================================
-- 2. Tenant Suspension Columns
-- ============================================================================
alter table public.businesses
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz default null,
  add column if not exists suspension_reason text default null;

create index if not exists idx_businesses_suspended
  on public.businesses(is_suspended);

-- ============================================================================
-- 3. Enhanced Manual Plan Override with Direct MoMo Revenue Tracking
-- ============================================================================
drop function if exists public.admin_override_business_plan(uuid, text, integer, text);
drop function if exists public.admin_override_business_plan(uuid, text, integer, text, numeric);

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
  v_new_expires timestamptz;
  v_biz public.businesses%rowtype;
  v_clean_tier text := lower(trim(p_plan_tier));
  v_amount numeric := coalesce(p_amount_paid, 0.00);
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  if v_clean_tier not in ('free', 'pro', 'enterprise') then
    raise exception 'Invalid plan tier: %', p_plan_tier;
  end if;

  select * into v_biz
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'Business not found.' using errcode = 'P0002';
  end if;

  if v_clean_tier = 'free' then
    v_new_expires := null;
  else
    if v_biz.plan_expires_at is not null and v_biz.plan_expires_at > clock_timestamp() then
      v_new_expires := v_biz.plan_expires_at + (p_days_valid || ' days')::interval;
    else
      v_new_expires := clock_timestamp() + (p_days_valid || ' days')::interval;
    end if;
  end if;

  update public.businesses
  set plan_tier = v_clean_tier,
      plan_expires_at = v_new_expires,
      updated_at = now()
  where id = p_business_id
  returning * into v_biz;

  -- Record manual payment in revenue ledger if payment amount was collected
  if v_amount > 0 and v_clean_tier in ('pro', 'enterprise') then
    insert into public.subscription_payments (
      business_id,
      reference,
      plan_tier,
      amount,
      currency,
      payment_method,
      payment_channel,
      duration_days,
      status,
      metadata
    ) values (
      p_business_id,
      'MOMO-ADMIN-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text), 1, 6),
      v_clean_tier,
      v_amount,
      coalesce(v_biz.currency, 'GHS'),
      'momo',
      'manual_admin',
      p_days_valid,
      'successful',
      jsonb_build_object(
        'recorded_by', auth.uid(),
        'reason', coalesce(nullif(trim(p_reason), ''), 'Direct MoMo Super Admin Override')
      )
    );
  end if;

  -- Record in immutable admin audit log
  insert into public.admin_audit_logs (admin_id, target_business_id, action, metadata)
  values (
    auth.uid(),
    p_business_id,
    'MANUAL_PLAN_OVERRIDE',
    jsonb_build_object(
      'plan_tier', v_clean_tier,
      'days_valid', p_days_valid,
      'expires_at', v_new_expires,
      'amount_paid', v_amount,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Super Admin Override')
    )
  );

  return jsonb_build_object(
    'success', true,
    'business_id', v_biz.id,
    'plan_tier', v_biz.plan_tier,
    'plan_expires_at', v_biz.plan_expires_at,
    'amount_paid', v_amount,
    'is_pro', (v_biz.plan_tier in ('pro', 'enterprise') and (v_biz.plan_expires_at is null or v_biz.plan_expires_at > clock_timestamp()))
  );
end;
$$;

revoke all on function public.admin_override_business_plan(uuid, text, integer, text, numeric) from public, anon;
grant execute on function public.admin_override_business_plan(uuid, text, integer, text, numeric) to authenticated;

-- ============================================================================
-- 4. Tenant Suspension / Reactivation RPC
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
  v_biz public.businesses%rowtype;
  v_action text := case when p_suspend then 'SUSPEND_STORE' else 'REACTIVATE_STORE' end;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  select * into v_biz
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'Business not found.' using errcode = 'P0002';
  end if;

  update public.businesses
  set is_suspended = p_suspend,
      suspended_at = case when p_suspend then clock_timestamp() else null end,
      suspension_reason = case when p_suspend then coalesce(nullif(trim(p_reason), ''), 'Administrative decision') else null end,
      updated_at = now()
  where id = p_business_id
  returning * into v_biz;

  insert into public.admin_audit_logs (admin_id, target_business_id, action, metadata)
  values (
    auth.uid(),
    p_business_id,
    v_action,
    jsonb_build_object(
      'is_suspended', p_suspend,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Super Admin action')
    )
  );

  return jsonb_build_object(
    'success', true,
    'business_id', v_biz.id,
    'is_suspended', v_biz.is_suspended,
    'suspended_at', v_biz.suspended_at,
    'suspension_reason', v_biz.suspension_reason
  );
end;
$$;

revoke all on function public.admin_toggle_business_suspension(uuid, boolean, text) from public, anon;
grant execute on function public.admin_toggle_business_suspension(uuid, boolean, text) to authenticated;

-- ============================================================================
-- 5. Updated Searchable Business Directory RPC with Total Count & Suspension
-- ============================================================================
drop function if exists public.admin_list_businesses(text, text, integer, integer);

create or replace function public.admin_list_businesses(
  p_search text default null,
  p_plan_filter text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_total_count integer := 0;
  v_items jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  -- 1. Compute total matching count for pagination
  select count(*) into v_total_count
  from public.businesses b
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id
  where (
    p_search is null
    or b.name ilike ('%' || trim(p_search) || '%')
    or b.phone ilike ('%' || trim(p_search) || '%')
    or b.email ilike ('%' || trim(p_search) || '%')
    or p.full_name ilike ('%' || trim(p_search) || '%')
    or u.email ilike ('%' || trim(p_search) || '%')
  )
  and (
    p_plan_filter is null or p_plan_filter = 'all'
    or (p_plan_filter = 'pro' and coalesce(b.plan_tier, 'free') in ('pro', 'enterprise') and (b.plan_expires_at is null or b.plan_expires_at > clock_timestamp()))
    or (p_plan_filter = 'free' and (coalesce(b.plan_tier, 'free') = 'free' or (b.plan_expires_at is not null and b.plan_expires_at <= clock_timestamp())))
    or (p_plan_filter = 'suspended' and coalesce(b.is_suspended, false) = true)
  );

  -- 2. Fetch paginated business slice
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'phone', coalesce(b.phone, ''),
        'email', coalesce(b.email, ''),
        'location', coalesce(b.location, ''),
        'currency', coalesce(b.currency, 'GHS'),
        'plan_tier', coalesce(b.plan_tier, 'free'),
        'plan_expires_at', b.plan_expires_at,
        'is_pro', (coalesce(b.plan_tier, 'free') in ('pro', 'enterprise') and (b.plan_expires_at is null or b.plan_expires_at > clock_timestamp())),
        'is_suspended', coalesce(b.is_suspended, false),
        'suspended_at', b.suspended_at,
        'suspension_reason', b.suspension_reason,
        'created_at', b.created_at,
        'owner_name', coalesce(p.full_name, 'Store Owner'),
        'owner_email', coalesce(u.email::text, b.email, ''),
        'products_count', coalesce((select count(*) from public.products pr where pr.business_id = b.id), 0),
        'total_sales_volume', coalesce((select sum(s.total) from public.sales s where s.business_id = b.id), 0),
        'sales_count', coalesce((select count(*) from public.sales s where s.business_id = b.id), 0),
        'total_count', v_total_count
      ) order by b.created_at desc
    ),
    '[]'::jsonb
  ) into v_items
  from (
    select b.*
    from public.businesses b
    left join public.profiles p on p.id = b.owner_id
    left join auth.users u on u.id = b.owner_id
    where (
      p_search is null
      or b.name ilike ('%' || trim(p_search) || '%')
      or b.phone ilike ('%' || trim(p_search) || '%')
      or b.email ilike ('%' || trim(p_search) || '%')
      or p.full_name ilike ('%' || trim(p_search) || '%')
      or u.email ilike ('%' || trim(p_search) || '%')
    )
    and (
      p_plan_filter is null or p_plan_filter = 'all'
      or (p_plan_filter = 'pro' and coalesce(b.plan_tier, 'free') in ('pro', 'enterprise') and (b.plan_expires_at is null or b.plan_expires_at > clock_timestamp()))
      or (p_plan_filter = 'free' and (coalesce(b.plan_tier, 'free') = 'free' or (b.plan_expires_at is not null and b.plan_expires_at <= clock_timestamp())))
      or (p_plan_filter = 'suspended' and coalesce(b.is_suspended, false) = true)
    )
    order by b.created_at desc
    limit v_lim
    offset v_off
  ) b
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id;

  return jsonb_build_object(
    'businesses', v_items,
    'total_count', v_total_count,
    'limit', v_lim,
    'offset', v_off
  );
end;
$$;

revoke all on function public.admin_list_businesses(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_businesses(text, text, integer, integer) to authenticated;
