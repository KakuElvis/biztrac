-- Keep staff PIN hashes private and enforce manager-only invoice access.
update public.staff_accounts
set password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf', 10)), updated_at = now()
where password_hash is not null and password_hash not like '$2%';

revoke all on public.staff_accounts from public, anon, authenticated;
grant insert, update, delete on public.staff_accounts to authenticated;
grant select (id, business_id, staff_id, role, is_active, failed_login_attempts, locked_until)
  on public.staff_accounts to authenticated;
drop policy if exists "Members can view staff accounts for their business" on public.staff_accounts;
drop policy if exists "Managers can view staff accounts for their business" on public.staff_accounts;
create policy "Managers can view staff accounts for their business" on public.staff_accounts
  for select to authenticated using (public.can_manage_business(business_id));

create or replace function public.list_manager_staff_accounts(p_business_id uuid)
returns table (id uuid, business_id uuid, staff_id text, full_name text, phone text,
  email text, role text, created_at timestamptz, failed_login_attempts integer, locked_until timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to view staff.' using errcode = '42501';
  end if;
  return query select a.id, a.business_id, a.staff_id, a.full_name, a.phone, a.email,
    a.role, a.created_at, a.failed_login_attempts, a.locked_until
  from public.staff_accounts a where a.business_id = p_business_id order by a.created_at;
end;
$$;
revoke all on function public.list_manager_staff_accounts(uuid) from public, anon;
grant execute on function public.list_manager_staff_accounts(uuid) to authenticated;

create or replace function public.save_staff_account(
  p_business_id uuid, p_staff_id text, p_password text, p_full_name text,
  p_phone text default null, p_email text default null, p_role text default 'staff'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to manage staff.' using errcode = '42501';
  end if;
  if nullif(trim(p_staff_id), '') is null or length(trim(coalesce(p_password, ''))) < 4
     or nullif(trim(p_full_name), '') is null or p_role not in ('owner', 'admin', 'staff') then
    raise exception 'Staff details are invalid.' using errcode = '23514';
  end if;
  insert into public.staff_accounts (business_id, staff_id, password_hash, full_name, phone, email, role, is_active)
  values (p_business_id, upper(trim(p_staff_id)),
    extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10)), trim(p_full_name),
    nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_email, '')), ''), p_role, true)
  on conflict (business_id, staff_id) do update set
    password_hash = excluded.password_hash, full_name = excluded.full_name,
    phone = excluded.phone, email = excluded.email, role = excluded.role, is_active = true,
    failed_login_attempts = 0, locked_until = null, updated_at = now()
  returning id into v_id;
  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;
revoke all on function public.save_staff_account(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_staff_account(uuid, text, text, text, text, text, text) to authenticated;

create or replace function public.verify_staff_session(p_business_id uuid, p_session_token text)
returns public.staff_sessions language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_session public.staff_sessions%rowtype;
begin
  if nullif(trim(coalesce(p_session_token, '')), '') is null then return null; end if;
  v_hash := encode(extensions.digest(trim(p_session_token), 'sha256'), 'hex');
  select s.* into v_session from public.staff_sessions s
  join public.staff_accounts a on a.id = s.staff_account_id
  where s.session_token_hash = v_hash and s.business_id = p_business_id
    and s.expires_at > clock_timestamp() and a.is_active
    and (a.locked_until is null or a.locked_until <= clock_timestamp());
  return v_session;
end;
$$;
revoke all on function public.verify_staff_session(uuid, text) from public;
grant execute on function public.verify_staff_session(uuid, text) to authenticated, anon;

drop policy if exists "Members can read billing documents" on public.billing_documents;
drop policy if exists "Members can insert billing documents" on public.billing_documents;
drop policy if exists "Members can update billing documents" on public.billing_documents;
drop policy if exists "Managers can delete billing documents" on public.billing_documents;
create policy "Managers can read billing documents" on public.billing_documents for select to authenticated using (public.can_manage_business(business_id));
create policy "Managers can insert billing documents" on public.billing_documents for insert to authenticated with check (public.can_manage_business(business_id));
create policy "Managers can update billing documents" on public.billing_documents for update to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));
create policy "Managers can delete billing documents" on public.billing_documents for delete to authenticated using (public.can_manage_business(business_id));

drop policy if exists "Members can read billing document items" on public.billing_document_items;
drop policy if exists "Members can insert billing document items" on public.billing_document_items;
drop policy if exists "Members can delete billing document items" on public.billing_document_items;
drop policy if exists "Managers can read billing document items" on public.billing_document_items;
drop policy if exists "Managers can insert billing document items" on public.billing_document_items;
drop policy if exists "Managers can delete billing document items" on public.billing_document_items;
create policy "Managers can read billing document items" on public.billing_document_items for select to authenticated
  using (exists (select 1 from public.billing_documents d where d.id = document_id and public.can_manage_business(d.business_id)));
create policy "Managers can insert billing document items" on public.billing_document_items for insert to authenticated
  with check (exists (select 1 from public.billing_documents d where d.id = document_id and public.can_manage_business(d.business_id)));
create policy "Managers can delete billing document items" on public.billing_document_items for delete to authenticated
  using (exists (select 1 from public.billing_documents d where d.id = document_id and public.can_manage_business(d.business_id)));

create or replace function public.save_billing_document(p_business_id uuid, p_document_id uuid, p_document jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.can_manage_business(p_business_id) then
    raise exception 'Manager privileges are required to manage billing documents.' using errcode = '42501';
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
