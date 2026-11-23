-- Hardens admin audit integrity and validates privileged manual plan changes.

create or replace function public.reject_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Admin audit events are append-only' using errcode = '42501';
end;
$$;

drop trigger if exists admin_audit_logs_append_only on public.admin_audit_logs;
create trigger admin_audit_logs_append_only
before update or delete on public.admin_audit_logs
for each row execute function public.reject_admin_audit_mutation();

revoke update, delete, truncate on public.admin_audit_logs from anon, authenticated;

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
  v_tier text := lower(trim(coalesce(p_plan_tier, '')));
  v_days integer := coalesce(p_days_valid, 30);
  v_amount numeric := coalesce(p_amount_paid, 0);
  v_biz public.businesses%rowtype;
  v_expires timestamptz;
  v_reference text;
begin
  if v_role not in ('super_admin', 'billing') then
    raise exception 'Unauthorized: Plan overrides require super_admin or billing role' using errcode = '42501';
  end if;
  if v_tier not in ('free', 'pro', 'enterprise') then
    raise exception 'Invalid plan tier' using errcode = '22023';
  end if;
  if v_tier <> 'free' and (v_days < 1 or v_days > 3650) then
    raise exception 'Plan duration must be between 1 and 3650 days' using errcode = '22023';
  end if;
  if v_amount < 0 or v_amount > 1000000 then
    raise exception 'Payment amount must be between 0 and 1000000' using errcode = '22023';
  end if;
  if v_amount > 0 and v_tier = 'free' then
    raise exception 'A paid subscription cannot be recorded for the free tier' using errcode = '22023';
  end if;
  if v_amount > 0 and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A payment reference or note is required when recording a payment' using errcode = '22023';
  end if;

  select * into v_biz from public.businesses where id = p_business_id for update;
  if not found then raise exception 'Business not found' using errcode = 'P0002'; end if;

  if v_tier = 'free' then
    v_expires := null;
  else
    v_expires := coalesce(greatest(v_biz.plan_expires_at, clock_timestamp()), clock_timestamp())
      + (v_days || ' days')::interval;
  end if;

  update public.businesses set plan_tier = v_tier, plan_expires_at = v_expires,
    updated_at = clock_timestamp() where id = p_business_id;

  if v_amount > 0 then
    v_reference := 'MOMO-ADMIN-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 8);
    insert into public.subscription_payments (
      business_id, reference, plan_tier, amount, currency, payment_method,
      payment_channel, duration_days, status, metadata
    ) values (
      p_business_id, v_reference, v_tier, v_amount, coalesce(v_biz.currency, 'GHS'),
      'momo', 'manual_admin', v_days, 'successful',
      jsonb_build_object('recorded_by', auth.uid(), 'plan_tier', v_tier,
      'days_valid', v_days, 'note', trim(p_reason))
    );
  end if;

  insert into public.admin_audit_logs (admin_id, target_business_id, action, metadata)
  values (auth.uid(), p_business_id, 'MANUAL_PLAN_OVERRIDE', jsonb_build_object(
    'previous_tier', v_biz.plan_tier, 'new_tier', v_tier, 'days_added', v_days,
    'amount_paid', v_amount, 'new_expires_at', v_expires, 'reason', trim(coalesce(p_reason, ''))
  ));

  return jsonb_build_object('success', true, 'business_id', p_business_id, 'plan_tier', v_tier,
    'plan_expires_at', v_expires, 'amount_paid', v_amount,
    'is_pro', v_tier in ('pro', 'enterprise') and (v_expires is null or v_expires > clock_timestamp()));
end;
$$;

revoke all on function public.admin_override_business_plan(uuid, text, integer, text, numeric) from public, anon;
grant execute on function public.admin_override_business_plan(uuid, text, integer, text, numeric) to authenticated;

-- Supporting indexes for tenant summary aggregation and chronological admin views.
create index if not exists idx_sales_business_sold_at on public.sales(business_id, sold_at desc);
create index if not exists idx_products_business_id on public.products(business_id);
create index if not exists idx_admin_audit_action_created on public.admin_audit_logs(action, created_at desc);
