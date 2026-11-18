-- Migration: 202611180001_debt_status_and_rpc_hardening.sql
-- Description:
-- 1. Adds debt_status column to public.sales ('active', 'forgiven', 'written_off', 'cancelled').
-- 2. Updates customer_balances view to only aggregate open active debts (excluding forgiven/written-off).
-- 3. Hardens pay_debt RPC with customer existence and business ownership validation.
-- 4. Introduces forgive_customer_debt RPC restricted to managers/owners (can_manage_business).

-- Step 1: Add debt_status column to sales table
alter table public.sales
  add column if not exists debt_status text not null default 'active'
  check (debt_status in ('active', 'forgiven', 'written_off', 'cancelled'));

create index if not exists sales_business_debt_status_idx
  on public.sales(business_id, debt_status)
  where debt_status = 'active';

-- Step 2: Update customer_balances view to only include active open debts
create or replace view public.customer_balances as
select
  s.business_id,
  s.customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  sum(s.total - s.amount_paid) as total_debt,
  count(s.id) as unpaid_sales_count,
  max(s.sold_at) as latest_sale_at
from public.sales s
left join public.customers c on c.id = s.customer_id
where s.total > s.amount_paid
  and s.debt_status = 'active'
group by s.business_id, s.customer_id, c.name, c.phone;

grant select on public.customer_balances to authenticated;

-- Step 3: Harden pay_debt RPC with customer-business relationship validation
create or replace function public.pay_debt(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash'
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale record;
  v_remaining numeric(12, 2) := greatest(0, p_amount);
  v_applied numeric(12, 2) := 0;
  v_needed numeric(12, 2);
  v_pay_amount numeric(12, 2);
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_business_member(p_business_id) then
    raise exception 'You are not a member of this business.' using errcode = '42501';
  end if;

  -- Validate customer belongs to the specified business
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

    v_remaining := v_remaining - v_pay_amount;
    v_applied := v_applied + v_pay_amount;
  end loop;

  return v_applied;
end;
$$;

grant execute on function public.pay_debt(
  uuid,
  uuid,
  numeric,
  text
) to authenticated;

-- Step 4: Add forgive_customer_debt RPC restricted to managers/owners
create or replace function public.forgive_customer_debt(
  p_business_id uuid,
  p_customer_id uuid,
  p_sale_id uuid default null,
  p_reason text default 'Debt forgiven by business owner',
  p_status text default 'forgiven'
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale record;
  v_forgiven_amount numeric(12, 2) := 0;
  v_debt numeric(12, 2);
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Security: Only managers and owners can forgive or write off debts
  if not public.can_manage_business(p_business_id) then
    raise exception 'Only business managers and owners can forgive or write off customer debt.' using errcode = '42501';
  end if;

  if p_status not in ('forgiven', 'written_off', 'cancelled') then
    raise exception 'Invalid debt status. Must be forgiven, written_off, or cancelled.';
  end if;

  -- Validate customer belongs to this business
  if not exists (
    select 1 from public.customers
    where id = p_customer_id
      and business_id = p_business_id
  ) then
    raise exception 'Customer was not found in this business.' using errcode = 'P0002';
  end if;

  for v_sale in
    select id, total, amount_paid, notes
    from public.sales
    where business_id = p_business_id
      and customer_id = p_customer_id
      and total > amount_paid
      and debt_status = 'active'
      and (p_sale_id is null or id = p_sale_id)
    order by sold_at asc
    for update
  loop
    v_debt := v_sale.total - v_sale.amount_paid;
    v_forgiven_amount := v_forgiven_amount + v_debt;

    update public.sales
    set debt_status = p_status,
        notes = case
          when nullif(trim(coalesce(notes, '')), '') is null
            then '[Status: ' || p_status || '] ' || coalesce(p_reason, '')
          else notes || E'\n' || '[Status: ' || p_status || '] ' || coalesce(p_reason, '')
        end
    where id = v_sale.id;
  end loop;

  return v_forgiven_amount;
end;
$$;

grant execute on function public.forgive_customer_debt(
  uuid,
  uuid,
  uuid,
  text,
  text
) to authenticated;
