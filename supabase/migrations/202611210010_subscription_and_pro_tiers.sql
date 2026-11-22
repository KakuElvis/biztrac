-- Migration: 202611210010_subscription_and_pro_tiers.sql
-- Description:
-- 1. Adds plan_tier ('free', 'pro', 'enterprise') and plan_expires_at to public.businesses.
-- 2. Creates public.subscription_payments table to record upgrade history and MoMo/Card transactions.
-- 3. Creates public.upgrade_business_plan RPC allowing store owners/managers to activate or extend Pro plans.

set search_path = public, extensions;

-- ============================================================================
-- 1. Add plan_tier and plan_expires_at to businesses table
-- ============================================================================
alter table public.businesses
  add column if not exists plan_tier text not null default 'free',
  add column if not exists plan_expires_at timestamptz default null;

-- Ensure check constraint for valid plan tiers
alter table public.businesses
  drop constraint if exists businesses_plan_tier_check;

alter table public.businesses
  add constraint businesses_plan_tier_check
  check (plan_tier in ('free', 'pro', 'enterprise'));

create index if not exists idx_businesses_plan_tier
  on public.businesses(plan_tier);

-- ============================================================================
-- 2. Create subscription_payments table
-- ============================================================================
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reference text not null unique,
  plan_tier text not null check (plan_tier in ('pro', 'enterprise')),
  amount numeric(12, 2) not null,
  currency text not null default 'GHS',
  payment_method text not null default 'momo',
  payment_channel text default 'paystack',
  duration_days integer not null default 30,
  status text not null default 'successful' check (status in ('pending', 'successful', 'failed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sub_payments_business
  on public.subscription_payments(business_id, created_at desc);

alter table public.subscription_payments enable row level security;

drop policy if exists "Members can view subscription payments" on public.subscription_payments;
create policy "Members can view subscription payments"
  on public.subscription_payments for select to authenticated
  using (public.can_manage_business(business_id));

-- ============================================================================
-- 3. RPC: upgrade_business_plan
-- ============================================================================
create or replace function public.upgrade_business_plan(
  p_business_id uuid,
  p_plan_tier text default 'pro',
  p_duration_days integer default 30,
  p_reference text default null,
  p_amount numeric default 0,
  p_payment_method text default 'momo'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_biz public.businesses%rowtype;
  v_new_expires_at timestamptz;
  v_clean_tier text := lower(trim(p_plan_tier));
  v_ref text;
begin
  -- Validate caller has manager or owner authority over this business
  if auth.uid() is null then
    raise exception 'Authentication required to manage subscription plans.' using errcode = '42501';
  end if;

  if not public.can_manage_business(p_business_id) then
    raise exception 'Only store owners or managers can manage subscription plans.' using errcode = '42501';
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
    v_new_expires_at := null;
  else
    -- If already has active pro expiration in the future, extend it
    if v_biz.plan_expires_at is not null and v_biz.plan_expires_at > clock_timestamp() then
      v_new_expires_at := v_biz.plan_expires_at + (p_duration_days || ' days')::interval;
    else
      v_new_expires_at := clock_timestamp() + (p_duration_days || ' days')::interval;
    end if;
  end if;

  -- Update business record
  update public.businesses
  set plan_tier = v_clean_tier,
      plan_expires_at = v_new_expires_at,
      updated_at = now()
  where id = p_business_id
  returning * into v_biz;

  -- Record payment history if paid upgrade
  v_ref := coalesce(p_reference, 'UPG-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8)));
  if p_amount > 0 or p_reference is not null then
    insert into public.subscription_payments (
      business_id,
      reference,
      plan_tier,
      amount,
      currency,
      payment_method,
      duration_days,
      status
    ) values (
      p_business_id,
      v_ref,
      v_clean_tier,
      coalesce(p_amount, 0),
      coalesce(v_biz.currency, 'GHS'),
      coalesce(p_payment_method, 'momo'),
      coalesce(p_duration_days, 30),
      'successful'
    ) on conflict (reference) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'business_id', v_biz.id,
    'plan_tier', v_biz.plan_tier,
    'plan_expires_at', v_biz.plan_expires_at,
    'is_pro', (v_biz.plan_tier in ('pro', 'enterprise') and (v_biz.plan_expires_at is null or v_biz.plan_expires_at > clock_timestamp()))
  );
end;
$$;

revoke all on function public.upgrade_business_plan(uuid, text, integer, text, numeric, text) from public, anon;
grant execute on function public.upgrade_business_plan(uuid, text, integer, text, numeric, text) to authenticated;

-- ============================================================================
-- 4. Server-Side Pro Tier Enforcement on Billing Documents
-- ============================================================================
create or replace function public.save_billing_document(p_business_id uuid, p_document_id uuid, p_document jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_plan text;
  v_expires timestamptz;
begin
  if auth.uid() is null or not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to manage billing documents.' using errcode = '42501';
  end if;

  -- Verify active Pro or Enterprise plan
  select plan_tier, plan_expires_at into v_plan, v_expires
  from public.businesses
  where id = p_business_id;

  if coalesce(v_plan, 'free') not in ('pro', 'enterprise') or (v_expires is not null and v_expires <= clock_timestamp()) then
    raise exception 'Invoicing and quotations require an active BizTrac Pro subscription.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one invoice line item is required.';
  end if;
  if p_document_id is null then
    insert into public.billing_documents (business_id, doc_number, doc_type, status, customer_name,
      customer_phone, customer_email, customer_address, issue_date, due_date, subtotal,
      discount_amount, tax_rate, tax_amount, total_amount, payment_terms, bank_momo_details, notes, updated_at)
    values (p_business_id, p_document->>'doc_number', p_document->>'doc_type', coalesce(p_document->>'status','draft'),
      p_document->>'customer_name', p_document->>'customer_phone', p_document->>'customer_email',
      p_document->>'customer_address', (p_document->>'issue_date')::date, nullif(p_document->>'due_date','')::date,
      coalesce((p_document->>'subtotal')::numeric,0), coalesce((p_document->>'discount_amount')::numeric,0),
      coalesce((p_document->>'tax_rate')::numeric,0), coalesce((p_document->>'tax_amount')::numeric,0),
      coalesce((p_document->>'total_amount')::numeric,0), p_document->>'payment_terms',
      p_document->>'bank_momo_details', p_document->>'notes', now()) returning id into v_id;
  else
    update public.billing_documents set doc_number=p_document->>'doc_number', doc_type=p_document->>'doc_type',
      status=coalesce(p_document->>'status','draft'), customer_name=p_document->>'customer_name',
      customer_phone=p_document->>'customer_phone', customer_email=p_document->>'customer_email',
      customer_address=p_document->>'customer_address', issue_date=(p_document->>'issue_date')::date,
      due_date=nullif(p_document->>'due_date','')::date, subtotal=coalesce((p_document->>'subtotal')::numeric,0),
      discount_amount=coalesce((p_document->>'discount_amount')::numeric,0),
      tax_rate=coalesce((p_document->>'tax_rate')::numeric,0), tax_amount=coalesce((p_document->>'tax_amount')::numeric,0),
      total_amount=coalesce((p_document->>'total_amount')::numeric,0), payment_terms=p_document->>'payment_terms',
      bank_momo_details=p_document->>'bank_momo_details', notes=p_document->>'notes', updated_at=now()
    where id=p_document_id and business_id=p_business_id returning id into v_id;
    if v_id is null then raise exception 'Invoice was not found in this business.' using errcode = 'P0002'; end if;
    delete from public.billing_document_items where document_id=v_id;
  end if;
  insert into public.billing_document_items(document_id,product_id,description,quantity,unit_price,line_total)
  select v_id, nullif(item->>'product_id','')::uuid, coalesce(nullif(item->>'description',''),'Item'),
    coalesce((item->>'quantity')::numeric,1), coalesce((item->>'unit_price')::numeric,0),
    coalesce((item->>'line_total')::numeric,0) from jsonb_array_elements(p_items) item;
  return v_id;
end;
$$;
revoke all on function public.save_billing_document(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_billing_document(uuid, uuid, jsonb, jsonb) to authenticated;
