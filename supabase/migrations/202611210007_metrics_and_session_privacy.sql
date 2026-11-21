-- Close gaps in the counter session and customer metrics APIs.
-- Session hashes are only needed by SECURITY DEFINER verification functions.
drop policy if exists "Members can read staff sessions" on public.staff_sessions;
revoke all on public.staff_sessions from public, anon, authenticated;
revoke all on function public.verify_staff_session(uuid, text) from public, anon, authenticated;

drop function if exists public.get_customer_metrics(uuid, uuid);
create function public.get_customer_metrics(
  p_business_id uuid,
  p_customer_id uuid,
  p_session_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.staff_sessions%rowtype;
  v_lifetime_spend numeric(12, 2) := 0;
  v_total_orders integer := 0;
  v_active_debt numeric(12, 2) := 0;
begin
  if auth.uid() is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required.' using errcode = '42501';
    end if;
  else
    v_session := public.verify_staff_session(p_business_id, p_session_token);
    if v_session.id is null then
      raise exception 'A valid counter session is required.' using errcode = '42501';
    end if;
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.business_id = p_business_id
  ) then
    raise exception 'Customer was not found in this business.' using errcode = 'P0002';
  end if;

  select coalesce(sum(s.total), 0), count(s.id)
  into v_lifetime_spend, v_total_orders
  from public.sales s
  where s.business_id = p_business_id and s.customer_id = p_customer_id;

  select coalesce(sum(s.total - s.amount_paid), 0)
  into v_active_debt
  from public.sales s
  where s.business_id = p_business_id
    and s.customer_id = p_customer_id
    and s.total > s.amount_paid
    and s.debt_status = 'active';

  return jsonb_build_object(
    'lifetime_spend', v_lifetime_spend,
    'total_orders', v_total_orders,
    'active_debt', v_active_debt
  );
end;
$$;

revoke all on function public.get_customer_metrics(uuid, uuid, text) from public;
grant execute on function public.get_customer_metrics(uuid, uuid, text) to anon, authenticated;

-- Counter customer selector data is exposed only through a verified session.
create or replace function public.list_counter_customers(
  p_business_id uuid,
  p_session_token text default null
)
returns table (
  id uuid,
  business_id uuid,
  name text,
  phone text,
  email text,
  notes text,
  debt numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.staff_sessions%rowtype;
begin
  if auth.uid() is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required.' using errcode = '42501';
    end if;
  else
    v_session := public.verify_staff_session(p_business_id, p_session_token);
    if v_session.id is null then
      raise exception 'A valid counter session is required.' using errcode = '42501';
    end if;
  end if;

  return query
  select c.id, c.business_id, c.name, coalesce(c.phone, ''), coalesce(c.email, ''),
         coalesce(c.notes, ''), coalesce(sum(s.total - s.amount_paid), 0)::numeric
  from public.customers c
  left join public.sales s on s.customer_id = c.id and s.business_id = c.business_id
    and s.total > s.amount_paid and s.debt_status = 'active'
  where c.business_id = p_business_id
  group by c.id, c.business_id, c.name, c.phone, c.email, c.notes
  order by c.name;
end;
$$;

revoke all on function public.list_counter_customers(uuid, text) from public;
grant execute on function public.list_counter_customers(uuid, text) to anon, authenticated;

create or replace function public.get_counter_customer_details(
  p_business_id uuid,
  p_customer_id uuid,
  p_session_token text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.staff_sessions%rowtype;
  v_customer public.customers%rowtype;
  v_purchases jsonb;
  v_total_orders integer;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required.' using errcode = '42501';
    end if;
  else
    v_session := public.verify_staff_session(p_business_id, p_session_token);
    if v_session.id is null then
      raise exception 'A valid counter session is required.' using errcode = '42501';
    end if;
  end if;

  select * into v_customer from public.customers
  where id = p_customer_id and business_id = p_business_id;
  if not found then
    raise exception 'Customer was not found in this business.' using errcode = 'P0002';
  end if;

  select count(*) into v_total_orders from public.sales s
  where s.business_id = p_business_id and s.customer_id = p_customer_id;

  select coalesce(jsonb_agg(q.sale_json order by q.created_at desc), '[]'::jsonb)
  into v_purchases
  from (
    select s.created_at,
      jsonb_build_object(
        'id', s.id,
        'created_at', s.created_at,
        'total', s.total,
        'amount_paid', s.amount_paid,
        'payment_method', s.payment_method,
        'due_date', s.due_date,
        'sale_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', si.id,
            'product_name', si.product_name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'line_total', si.line_total
          ) order by si.created_at)
          from public.sale_items si where si.sale_id = s.id
        ), '[]'::jsonb)
      ) as sale_json
    from public.sales s
    where s.business_id = p_business_id and s.customer_id = p_customer_id
    order by s.created_at desc
    offset v_offset limit v_limit
  ) q;

  return jsonb_build_object(
    'customer', jsonb_build_object(
      'id', v_customer.id, 'business_id', v_customer.business_id, 'name', v_customer.name,
      'phone', coalesce(v_customer.phone, ''), 'email', coalesce(v_customer.email, ''),
      'notes', coalesce(v_customer.notes, '')
    ),
    'metrics', jsonb_build_object(
      'lifetime_spend', coalesce((select sum(s.total) from public.sales s where s.business_id = p_business_id and s.customer_id = p_customer_id), 0),
      'total_orders', v_total_orders,
      'active_debt', coalesce((select sum(s.total - s.amount_paid) from public.sales s where s.business_id = p_business_id and s.customer_id = p_customer_id and s.total > s.amount_paid and s.debt_status = 'active'), 0)
    ),
    'total_orders', v_total_orders,
    'purchases', v_purchases
  );
end;
$$;

revoke all on function public.get_counter_customer_details(uuid, uuid, text, integer, integer) from public;
grant execute on function public.get_counter_customer_details(uuid, uuid, text, integer, integer) to anon, authenticated;

create or replace function public.save_counter_customer(
  p_business_id uuid,
  p_customer_id uuid default null,
  p_name text default '',
  p_phone text default '',
  p_email text default '',
  p_notes text default '',
  p_session_token text default null
)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.staff_sessions%rowtype;
  v_customer public.customers%rowtype;
begin
  if auth.uid() is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'A signed-in business member is required.' using errcode = '42501';
    end if;
  else
    v_session := public.verify_staff_session(p_business_id, p_session_token);
    if v_session.id is null then
      raise exception 'A valid counter session is required.' using errcode = '42501';
    end if;
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Customer name is required.' using errcode = '23514';
  end if;

  if p_customer_id is null then
    insert into public.customers (business_id, name, phone, email, notes)
    values (p_business_id, trim(p_name), nullif(trim(coalesce(p_phone, '')), ''),
            nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_notes, '')), ''))
    returning * into v_customer;
  else
    update public.customers c
    set name = trim(p_name), phone = nullif(trim(coalesce(p_phone, '')), ''),
        email = nullif(trim(coalesce(p_email, '')), ''), notes = nullif(trim(coalesce(p_notes, '')), '')
    where c.id = p_customer_id and c.business_id = p_business_id
    returning c.* into v_customer;
    if not found then
      raise exception 'Customer was not found in this business.' using errcode = 'P0002';
    end if;
  end if;
  return v_customer;
end;
$$;

revoke all on function public.save_counter_customer(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.save_counter_customer(uuid, uuid, text, text, text, text, text) to anon, authenticated;
