-- Migration: Optional, Configurable Ghana VAT & Levies (Act 1151)
-- Description: Adds business tax configuration, product tax classification, and sale tax snapshots.

-- 1. Business Tax Configuration
alter table public.businesses
  add column if not exists vat_enabled boolean not null default false,
  add column if not exists tin_number text,
  add column if not exists tax_pricing_mode text not null default 'exclusive',
  add column if not exists vat_rate numeric(5, 2) not null default 15.00,
  add column if not exists nhil_rate numeric(5, 2) not null default 2.50,
  add column if not exists getfund_rate numeric(5, 2) not null default 2.50;

-- 2. Product Tax Treatment Classification ('standard' | 'zero_rated' | 'exempt')
alter table public.products
  add column if not exists tax_treatment text not null default 'standard';

-- 3. Sale-Level Tax Snapshots
alter table public.sales
  add column if not exists subtotal_ex_tax numeric(12, 2) not null default 0,
  add column if not exists total_nhil numeric(12, 2) not null default 0,
  add column if not exists total_getfund numeric(12, 2) not null default 0,
  add column if not exists total_vat numeric(12, 2) not null default 0,
  add column if not exists total_tax numeric(12, 2) not null default 0,
  add column if not exists tin_snapshot text,
  add column if not exists tax_mode_snapshot text;

-- 4. Line-Item Tax Snapshots
alter table public.sale_items
  add column if not exists tax_treatment_snapshot text not null default 'standard',
  add column if not exists taxable_amount numeric(12, 2) not null default 0,
  add column if not exists nhil_amount numeric(12, 2) not null default 0,
  add column if not exists getfund_amount numeric(12, 2) not null default 0,
  add column if not exists vat_amount numeric(12, 2) not null default 0,
  add column if not exists total_tax numeric(12, 2) not null default 0;

-- 5. Update record_sale RPC with Ghana Act 1151 tax engine
create or replace function public.record_sale(
  p_business_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_notes text default null,
  p_amount_paid numeric default null,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_biz public.businesses%rowtype;
  v_sale_id uuid := gen_random_uuid();
  v_reference text;
  v_customer_id uuid := p_customer_id;
  v_customer public.customers%rowtype;
  v_customer_json jsonb := null;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;

  -- Tax variables
  v_vat_enabled boolean := false;
  v_pricing_mode text := 'exclusive';
  v_vat_rate numeric(5, 4) := 0.15;
  v_nhil_rate numeric(5, 4) := 0.025;
  v_getfund_rate numeric(5, 4) := 0.025;
  v_combined_rate numeric(5, 4) := 0.20;

  v_item_raw numeric(12, 2);
  v_taxable_amount numeric(12, 2);
  v_item_nhil numeric(12, 2);
  v_item_getfund numeric(12, 2);
  v_item_vat numeric(12, 2);
  v_item_tax numeric(12, 2);
  v_line_total numeric(12, 2);

  v_subtotal_ex_tax numeric(12, 2) := 0;
  v_total_nhil numeric(12, 2) := 0;
  v_total_getfund numeric(12, 2) := 0;
  v_total_vat numeric(12, 2) := 0;
  v_total_tax numeric(12, 2) := 0;
  v_grand_total numeric(12, 2) := 0;
  v_amount_paid numeric(12, 2) := 0;

  v_updated_product public.products%rowtype;
  v_updated_products jsonb := '[]'::jsonb;
  v_sale public.sales%rowtype;
begin
  -- Validate business membership or counter session
  if v_user_id is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'You are not a member of this business.' using errcode = '42501';
    end if;
  end if;

  select * into v_biz
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'Store not found or invalid business.' using errcode = '42501';
  end if;

  -- Read business tax settings
  v_vat_enabled := coalesce(v_biz.vat_enabled, false);
  v_pricing_mode := coalesce(v_biz.tax_pricing_mode, 'exclusive');
  v_vat_rate := coalesce(v_biz.vat_rate, 15.00) / 100.0;
  v_nhil_rate := coalesce(v_biz.nhil_rate, 2.50) / 100.0;
  v_getfund_rate := coalesce(v_biz.getfund_rate, 2.50) / 100.0;
  v_combined_rate := v_vat_rate + v_nhil_rate + v_getfund_rate;

  if p_payment_method not in ('cash', 'momo', 'bank', 'credit') then
    raise exception 'Unsupported payment method.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product to the cart.';
  end if;

  if p_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = p_customer_id
      and business_id = p_business_id;

    if not found then
      raise exception 'Selected customer was not found.';
    end if;

    v_customer_json := to_jsonb(v_customer);
  elsif nullif(trim(coalesce(p_customer_name, '')), '') is not null then
    insert into public.customers (business_id, name, phone)
    values (
      p_business_id,
      trim(p_customer_name),
      nullif(trim(coalesce(p_customer_phone, '')), '')
    )
    returning * into v_customer;

    v_customer_id := v_customer.id;
    v_customer_json := to_jsonb(v_customer);
  end if;

  if p_payment_method = 'credit' and v_customer_id is null then
    raise exception 'Credit sales require a customer.';
  end if;

  v_reference :=
    'BT-' ||
    to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') ||
    '-' ||
    upper(substr(gen_random_uuid()::text, 1, 6));

  insert into public.sales (
    id,
    business_id,
    customer_id,
    reference,
    payment_method,
    subtotal,
    discount,
    total,
    amount_paid,
    notes,
    sold_by,
    due_date,
    subtotal_ex_tax,
    total_nhil,
    total_getfund,
    total_vat,
    total_tax,
    tin_snapshot,
    tax_mode_snapshot
  )
  values (
    v_sale_id,
    p_business_id,
    v_customer_id,
    v_reference,
    p_payment_method,
    0,
    0,
    0,
    0,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_user_id,
    p_due_date,
    0,
    0,
    0,
    0,
    0,
    v_biz.tin_number,
    v_pricing_mode
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Sale quantities must be whole numbers greater than zero.';
    end if;

    select *
    into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'A cart product was not found.';
    end if;

    if v_product.quantity < v_quantity then
      raise exception '% only has % in stock.', v_product.name, v_product.quantity;
    end if;

    v_item_raw := round(v_quantity * v_product.selling_price, 2);

    -- Compute line taxes
    if (not v_vat_enabled) or (v_product.tax_treatment in ('zero_rated', 'exempt')) then
      v_taxable_amount := v_item_raw;
      v_item_nhil := 0;
      v_item_getfund := 0;
      v_item_vat := 0;
      v_item_tax := 0;
      v_line_total := v_item_raw;
    elsif v_pricing_mode = 'inclusive' then
      v_taxable_amount := round(v_item_raw / (1 + v_combined_rate), 2);
      v_item_nhil := round(v_taxable_amount * v_nhil_rate, 2);
      v_item_getfund := round(v_taxable_amount * v_getfund_rate, 2);
      v_item_vat := round(v_taxable_amount * v_vat_rate, 2);
      v_item_tax := v_item_nhil + v_item_getfund + v_item_vat;
      v_line_total := v_item_raw;
    else
      -- Exclusive pricing
      v_taxable_amount := v_item_raw;
      v_item_nhil := round(v_taxable_amount * v_nhil_rate, 2);
      v_item_getfund := round(v_taxable_amount * v_getfund_rate, 2);
      v_item_vat := round(v_taxable_amount * v_vat_rate, 2);
      v_item_tax := v_item_nhil + v_item_getfund + v_item_vat;
      v_line_total := v_taxable_amount + v_item_tax;
    end if;

    v_subtotal_ex_tax := v_subtotal_ex_tax + v_taxable_amount;
    v_total_nhil := v_total_nhil + v_item_nhil;
    v_total_getfund := v_total_getfund + v_item_getfund;
    v_total_vat := v_total_vat + v_item_vat;
    v_total_tax := v_total_tax + v_item_tax;
    v_grand_total := v_grand_total + v_line_total;

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      unit_cost,
      line_total,
      tax_treatment_snapshot,
      taxable_amount,
      nhil_amount,
      getfund_amount,
      vat_amount,
      total_tax
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.selling_price,
      v_product.cost_price,
      v_line_total,
      coalesce(v_product.tax_treatment, 'standard'),
      v_taxable_amount,
      v_item_nhil,
      v_item_getfund,
      v_item_vat,
      v_item_tax
    );

    update public.products
    set quantity = quantity - v_quantity
    where id = v_product.id
      and business_id = p_business_id
    returning * into v_updated_product;

    v_updated_products := v_updated_products || jsonb_build_array(to_jsonb(v_updated_product));
  end loop;

  if p_amount_paid is not null then
    v_amount_paid := greatest(0, least(v_grand_total, p_amount_paid));
  elsif p_payment_method = 'credit' then
    v_amount_paid := 0;
  else
    v_amount_paid := v_grand_total;
  end if;

  update public.sales
  set subtotal = v_subtotal_ex_tax,
      total = v_grand_total,
      amount_paid = v_amount_paid,
      subtotal_ex_tax = v_subtotal_ex_tax,
      total_nhil = v_total_nhil,
      total_getfund = v_total_getfund,
      total_vat = v_total_vat,
      total_tax = v_total_tax
  where id = v_sale_id
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'customer', v_customer_json,
    'updated_products', v_updated_products
  );
end;
$$;

grant execute on function public.record_sale(
  uuid,
  text,
  jsonb,
  uuid,
  text,
  text,
  text,
  numeric,
  date
) to anon, authenticated;

-- 6. Update authenticate_staff RPC to include store receipt & tax settings
alter table if exists public.staff_accounts
  add column if not exists is_active boolean not null default true;

create or replace function public.authenticate_staff(
  p_staff_id text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff_accounts%rowtype;
  v_biz public.businesses%rowtype;
begin
  select * into v_staff
  from public.staff_accounts
  where upper(trim(staff_id)) = upper(trim(p_staff_id))
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Staff ID not found. Please verify with your store owner.');
  end if;

  if v_staff.password_hash <> trim(p_password) then
    return jsonb_build_object('success', false, 'error', 'Incorrect password. Please try again.');
  end if;

  select * into v_biz
  from public.businesses
  where id = v_staff.business_id;

  return jsonb_build_object(
    'success', true,
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'business_id', v_staff.business_id,
      'staff_id', v_staff.staff_id,
      'full_name', v_staff.full_name,
      'phone', coalesce(v_staff.phone, ''),
      'email', coalesce(v_staff.email, ''),
      'role', v_staff.role
    ),
    'business', jsonb_build_object(
      'id', coalesce(v_biz.id, v_staff.business_id),
      'name', coalesce(v_biz.name, 'BizTrac Store'),
      'currency', coalesce(v_biz.currency, 'GHS'),
      'location', coalesce(v_biz.location, ''),
      'phone', coalesce(v_biz.phone, ''),
      'slogan', coalesce(v_biz.slogan, ''),
      'momo_details', coalesce(v_biz.momo_details, ''),
      'return_policy', coalesce(v_biz.return_policy, 'Goods sold in good condition are not returnable after 3 days.'),
      'receipt_width', coalesce(v_biz.receipt_width, '58mm'),
      'receipt_footer', coalesce(v_biz.receipt_footer, 'Thank you for your patronage! Visit again.'),
      'vat_enabled', coalesce(v_biz.vat_enabled, false),
      'tin_number', coalesce(v_biz.tin_number, ''),
      'tax_pricing_mode', coalesce(v_biz.tax_pricing_mode, 'exclusive'),
      'vat_rate', coalesce(v_biz.vat_rate, 15.00),
      'nhil_rate', coalesce(v_biz.nhil_rate, 2.50),
      'getfund_rate', coalesce(v_biz.getfund_rate, 2.50)
    )
  );
end;
$$;

grant execute on function public.authenticate_staff(text, text) to anon, authenticated;
