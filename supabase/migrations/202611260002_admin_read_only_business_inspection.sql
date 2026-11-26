-- Return a bounded, read-only store snapshot for support and super-admin inspection.
create or replace function public.admin_impersonate_business(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.get_admin_role();
  v_business jsonb;
  v_low_stock_products jsonb;
  v_recent_sales jsonb;
  v_products_count bigint;
  v_low_stock_count bigint;
  v_customers_count bigint;
  v_sales_count bigint;
  v_month_sales_count bigint;
  v_sales_total numeric;
  v_expenses_total numeric;
begin
  if v_role not in ('super_admin', 'support') then
    raise exception 'Unauthorized: Store inspection requires super_admin or support role'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'currency', b.currency,
    'location', b.location,
    'phone', b.phone,
    'email', b.email,
    'plan_tier', b.plan_tier,
    'plan_expires_at', b.plan_expires_at,
    'is_suspended', b.is_suspended,
    'suspension_reason', b.suspension_reason,
    'created_at', b.created_at,
    'owner_name', coalesce(p.full_name, 'Store Owner'),
    'owner_email', coalesce(u.email::text, b.email, '')
  )
  into v_business
  from public.businesses b
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id
  where b.id = p_business_id;

  if v_business is null then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  select count(*) into v_products_count
  from public.products p
  where p.business_id = p_business_id;

  select count(*) into v_low_stock_count
  from public.products p
  where p.business_id = p_business_id
    and p.quantity <= p.low_stock_limit;

  select count(*) into v_customers_count
  from public.customers c
  where c.business_id = p_business_id;

  select
    count(*),
    count(*) filter (where s.sold_at >= date_trunc('month', clock_timestamp())),
    coalesce(sum(s.total), 0)
  into v_sales_count, v_month_sales_count, v_sales_total
  from public.sales s
  where s.business_id = p_business_id;

  select coalesce(sum(e.amount), 0)
  into v_expenses_total
  from public.expenses e
  where e.business_id = p_business_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'sku', p.sku,
        'quantity', p.quantity,
        'low_stock_limit', p.low_stock_limit
      ) order by p.quantity asc, p.name asc
    ),
    '[]'::jsonb
  )
  into v_low_stock_products
  from (
    select p.id, p.name, p.sku, p.quantity, p.low_stock_limit
    from public.products p
    where p.business_id = p_business_id
      and p.quantity <= p.low_stock_limit
    order by p.quantity asc, p.name asc
    limit 10
  ) p;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'reference', s.reference,
        'sold_at', s.sold_at,
        'total', s.total,
        'amount_paid', s.amount_paid,
        'payment_method', s.payment_method
      ) order by s.sold_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_sales
  from (
    select s.id, s.reference, s.sold_at, s.total, s.amount_paid, s.payment_method
    from public.sales s
    where s.business_id = p_business_id
    order by s.sold_at desc
    limit 10
  ) s;

  insert into public.admin_audit_logs (admin_id, target_business_id, action, metadata)
  values (
    auth.uid(),
    p_business_id,
    'INSPECT_STORE',
    jsonb_build_object(
      'store_name', v_business->>'name',
      'inspection_mode', 'read_only_snapshot',
      'inspected_at', clock_timestamp()
    )
  );

  return jsonb_build_object(
    'success', true,
    'business', v_business,
    'metrics', jsonb_build_object(
      'products_count', v_products_count,
      'low_stock_count', v_low_stock_count,
      'customers_count', v_customers_count,
      'sales_count', v_sales_count,
      'current_month_sales_count', v_month_sales_count,
      'sales_total', v_sales_total,
      'expenses_total', v_expenses_total
    ),
    'low_stock_products', v_low_stock_products,
    'recent_sales', v_recent_sales
  );
end;
$$;

revoke all on function public.admin_impersonate_business(uuid) from public, anon;
grant execute on function public.admin_impersonate_business(uuid) to authenticated;
