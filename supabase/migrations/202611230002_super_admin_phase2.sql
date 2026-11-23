-- Migration: 202611230002_super_admin_phase2.sql
-- Description:
-- 1. Database-level rejection of sales on suspended businesses in public.record_sale.
-- 2. Dynamic column sorting (name, GMV, products, expiry, created_at) in public.admin_list_businesses.
-- 3. Action-type filtering and full pagination in public.admin_get_audit_logs.

set search_path = public, extensions;

-- ============================================================================
-- 1. Enforce Business Suspension at Database Level in record_sale
-- ============================================================================
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
set search_path = ''
as $$
declare
  v_result jsonb;
  v_products jsonb;
  v_business_id uuid;
begin
  -- Block sale attempts if the store is suspended by an administrator
  if exists (
    select 1 from public.businesses
    where id = p_business_id and is_suspended = true
  ) then
    raise exception 'Business account is suspended by administrator.' using errcode = '42501';
  end if;

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

revoke all on function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid) from public;
grant execute on function public.record_sale(uuid, text, jsonb, uuid, text, text, text, numeric, date, text, uuid, uuid) to anon, authenticated;

-- ============================================================================
-- 2. Dynamic Column Sorting in admin_list_businesses
-- ============================================================================
drop function if exists public.admin_list_businesses(text, text, integer, integer);
drop function if exists public.admin_list_businesses(text, text, text, text, integer, integer);

create or replace function public.admin_list_businesses(
  p_search text default null,
  p_plan_filter text default 'all',
  p_sort_by text default 'created_at',
  p_sort_dir text default 'desc',
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
  v_sort_by text := lower(trim(coalesce(p_sort_by, 'created_at')));
  v_sort_dir text := lower(trim(coalesce(p_sort_dir, 'desc')));
  v_total_count integer := 0;
  v_items jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  if v_sort_dir not in ('asc', 'desc') then
    v_sort_dir := 'desc';
  end if;

  if v_sort_by not in ('created_at', 'name', 'total_sales_volume', 'products_count', 'plan_expires_at') then
    v_sort_by := 'created_at';
  end if;

  -- 1. Compute total matching count
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

  -- 2. Fetch sorted and paginated slice with lateral aggregations
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
        'products_count', b.products_count,
        'total_sales_volume', b.total_sales_volume,
        'sales_count', b.sales_count,
        'total_count', v_total_count
      )
    ),
    '[]'::jsonb
  ) into v_items
  from (
    select
      b.*,
      coalesce(s_agg.total_sales_volume, 0) as total_sales_volume,
      coalesce(s_agg.sales_count, 0) as sales_count,
      coalesce(p_agg.products_count, 0) as products_count
    from public.businesses b
    left join public.profiles p on p.id = b.owner_id
    left join auth.users u on u.id = b.owner_id
    left join lateral (
      select coalesce(sum(s.total), 0) as total_sales_volume, count(*) as sales_count
      from public.sales s where s.business_id = b.id
    ) s_agg on true
    left join lateral (
      select count(*) as products_count
      from public.products pr where pr.business_id = b.id
    ) p_agg on true
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
    order by
      case when v_sort_by = 'name' and v_sort_dir = 'asc' then b.name end asc,
      case when v_sort_by = 'name' and v_sort_dir = 'desc' then b.name end desc,
      case when v_sort_by = 'total_sales_volume' and v_sort_dir = 'asc' then s_agg.total_sales_volume end asc,
      case when v_sort_by = 'total_sales_volume' and v_sort_dir = 'desc' then s_agg.total_sales_volume end desc,
      case when v_sort_by = 'products_count' and v_sort_dir = 'asc' then p_agg.products_count end asc,
      case when v_sort_by = 'products_count' and v_sort_dir = 'desc' then p_agg.products_count end desc,
      case when v_sort_by = 'plan_expires_at' and v_sort_dir = 'asc' then b.plan_expires_at end asc nulls last,
      case when v_sort_by = 'plan_expires_at' and v_sort_dir = 'desc' then b.plan_expires_at end desc nulls last,
      case when v_sort_by = 'created_at' and v_sort_dir = 'asc' then b.created_at end asc,
      case when v_sort_by = 'created_at' and v_sort_dir = 'desc' then b.created_at end desc,
      b.created_at desc
    limit v_lim
    offset v_off
  ) b
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id;

  return jsonb_build_object(
    'businesses', v_items,
    'total_count', v_total_count,
    'sort_by', v_sort_by,
    'sort_dir', v_sort_dir,
    'limit', v_lim,
    'offset', v_off
  );
end;
$$;

-- Overload for backwards compatibility with 4 positional arguments
create or replace function public.admin_list_businesses(
  p_search text,
  p_plan_filter text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_list_businesses(p_search, p_plan_filter, 'created_at', 'desc', p_limit, p_offset);
$$;

revoke all on function public.admin_list_businesses(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_businesses(text, text, text, text, integer, integer) to authenticated;

revoke all on function public.admin_list_businesses(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_businesses(text, text, integer, integer) to authenticated;

-- ============================================================================
-- 3. Action-Type Filtering & Pagination in admin_get_audit_logs
-- ============================================================================
drop function if exists public.admin_get_audit_logs(integer, integer);
drop function if exists public.admin_get_audit_logs(text, integer, integer);

create or replace function public.admin_get_audit_logs(
  p_action_filter text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_total_count integer := 0;
  v_logs jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super admin access required' using errcode = '42501';
  end if;

  -- 1. Compute total matching count
  select count(*) into v_total_count
  from public.admin_audit_logs l
  where (
    p_action_filter is null or p_action_filter = 'all'
    or (p_action_filter = 'overrides' and l.action = 'MANUAL_PLAN_OVERRIDE')
    or (p_action_filter = 'suspensions' and l.action in ('SUSPEND_STORE', 'REACTIVATE_STORE'))
    or (l.action = p_action_filter)
  );

  -- 2. Fetch paginated slice
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'admin_id', l.admin_id,
        'target_business_id', l.target_business_id,
        'target_business_name', coalesce(b.name, 'Deleted Business'),
        'action', l.action,
        'metadata', l.metadata,
        'created_at', l.created_at,
        'total_count', v_total_count
      ) order by l.created_at desc
    ),
    '[]'::jsonb
  ) into v_logs
  from (
    select l.*
    from public.admin_audit_logs l
    where (
      p_action_filter is null or p_action_filter = 'all'
      or (p_action_filter = 'overrides' and l.action = 'MANUAL_PLAN_OVERRIDE')
      or (p_action_filter = 'suspensions' and l.action in ('SUSPEND_STORE', 'REACTIVATE_STORE'))
      or (l.action = p_action_filter)
    )
    order by l.created_at desc
    limit v_lim
    offset v_off
  ) l
  left join public.businesses b on b.id = l.target_business_id;

  return jsonb_build_object(
    'logs', v_logs,
    'total_count', v_total_count,
    'limit', v_lim,
    'offset', v_off
  );
end;
$$;

-- Overload for backwards compatibility with 2 positional arguments (limit, offset)
create or replace function public.admin_get_audit_logs(
  p_limit integer,
  p_offset integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_get_audit_logs('all', p_limit, p_offset);
$$;

revoke all on function public.admin_get_audit_logs(text, integer, integer) from public, anon;
grant execute on function public.admin_get_audit_logs(text, integer, integer) to authenticated;

revoke all on function public.admin_get_audit_logs(integer, integer) from public, anon;
grant execute on function public.admin_get_audit_logs(integer, integer) to authenticated;
