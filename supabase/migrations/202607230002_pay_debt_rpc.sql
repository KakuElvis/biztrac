-- Migration: Add pay_debt RPC function to record debt repayments

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

  if v_remaining <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  for v_sale in
    select id, total, amount_paid
    from public.sales
    where business_id = p_business_id
      and customer_id = p_customer_id
      and total > amount_paid
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
