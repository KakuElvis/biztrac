-- Migration: 202611220001_super_admin_portal.sql
-- Description:
-- 1. Creates public.super_admins table and public.is_super_admin() helper.
-- 2. Creates public.admin_audit_logs table for immutable tracking of admin operations.
-- 3. Introduces SECURITY DEFINER admin RPCs:
--    - admin_get_dashboard_stats()
--    - admin_list_businesses(search, plan_filter, limit, offset)
--    - admin_override_business_plan(business_id, plan_tier, days_valid, reason)
--    - admin_get_audit_logs(limit, offset)

set search_path = public, extensions;

-- ============================================================================
-- 1. Super Admins Whitelist Table
-- ============================================================================
create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin', 'support', 'billing')),
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

drop policy if exists "Super admins can view super_admins" on public.super_admins;
create policy "Super admins can view super_admins"
  on public.super_admins for select
  to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

-- Secure helper function
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.super_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- ============================================================================
-- 2. Immutable Platform Audit Log
-- ============================================================================
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  target_business_id uuid references public.businesses(id) on delete set null,
  action text not null, -- 'MANUAL_UPGRADE', 'EXTEND_PLAN', 'SUSPEND_STORE'
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_target
  on public.admin_audit_logs(target_business_id, created_at desc);

create index if not exists idx_admin_audit_created
  on public.admin_audit_logs(created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Super admins can read audit logs" on public.admin_audit_logs;
create policy "Super admins can read audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using (public.is_super_admin());

-- ============================================================================
-- 3. Executive KPI Dashboard RPC
-- ============================================================================
create or replace function public.admin_get_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stats jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_businesses', (select count(*) from public.businesses),
    'active_pro', (
      select count(*) from public.businesses 
      where plan_tier in ('pro', 'enterprise') 
        and (plan_expires_at is null or plan_expires_at > clock_timestamp())
    ),
    'free_tier', (
      select count(*) from public.businesses 
      where plan_tier = 'free' or (plan_expires_at is not null and plan_expires_at <= clock_timestamp())
    ),
    'total_revenue_ghs', (
      select coalesce(sum(amount), 0) from public.subscription_payments where status = 'successful'
    ),
    'platform_gmv_ghs', (
      select coalesce(sum(total), 0) from public.sales
    ),
    'current_month_sales_count', (
      select count(*) from public.sales 
      where sold_at >= date_trunc('month', clock_timestamp())
    ),
    'total_products_tracked', (
      select count(*) from public.products
    ),
    'total_cashiers', (
      select count(*) from public.staff_accounts where role = 'staff'
    )
  ) into v_stats;

  return v_stats;
end;
$$;

revoke all on function public.admin_get_dashboard_stats() from public, anon;
grant execute on function public.admin_get_dashboard_stats() to authenticated;

-- ============================================================================
-- 4. Searchable Business Directory RPC
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
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

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
        'created_at', b.created_at,
        'owner_name', coalesce(p.full_name, 'Store Owner'),
        'owner_email', coalesce(u.email::text, b.email, ''),
        'products_count', coalesce((select count(*) from public.products pr where pr.business_id = b.id), 0),
        'total_sales_volume', coalesce((select sum(s.total) from public.sales s where s.business_id = b.id), 0),
        'sales_count', coalesce((select count(*) from public.sales s where s.business_id = b.id), 0)
      ) order by b.created_at desc
    ),
    '[]'::jsonb
  ) into v_result
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
    )
    order by b.created_at desc
    limit v_lim
    offset v_off
  ) b
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id;

  return v_result;
end;
$$;

revoke all on function public.admin_list_businesses(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_businesses(text, text, integer, integer) to authenticated;

-- ============================================================================
-- 5. Manual Plan Override & Extension RPC
-- ============================================================================
create or replace function public.admin_override_business_plan(
  p_business_id uuid,
  p_plan_tier text,
  p_days_valid integer default 30,
  p_reason text default ''
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
      'reason', coalesce(nullif(trim(p_reason), ''), 'Super Admin Override')
    )
  );

  return jsonb_build_object(
    'success', true,
    'business_id', v_biz.id,
    'plan_tier', v_biz.plan_tier,
    'plan_expires_at', v_biz.plan_expires_at,
    'is_pro', (v_biz.plan_tier in ('pro', 'enterprise') and (v_biz.plan_expires_at is null or v_biz.plan_expires_at > clock_timestamp()))
  );
end;
$$;

revoke all on function public.admin_override_business_plan(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_override_business_plan(uuid, text, integer, text) to authenticated;

-- ============================================================================
-- 6. Audit Logs Query RPC
-- ============================================================================
create or replace function public.admin_get_audit_logs(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  admin_id uuid,
  target_business_id uuid,
  target_business_name text,
  action text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  return query
  select
    l.id,
    l.admin_id,
    l.target_business_id,
    coalesce(b.name, 'Deleted Business') as target_business_name,
    l.action,
    l.metadata,
    l.created_at
  from public.admin_audit_logs l
  left join public.businesses b on b.id = l.target_business_id
  order by l.created_at desc
  limit v_lim
  offset v_off;
end;
$$;

revoke all on function public.admin_get_audit_logs(integer, integer) from public, anon;
grant execute on function public.admin_get_audit_logs(integer, integer) to authenticated;
