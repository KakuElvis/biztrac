-- Migration: Enable Staff Counter Login for unauthenticated cashiers
-- Description: Allows counter cashiers to verify their Staff ID & password at the login screen.

-- 1. Policy to allow counter login lookup for unauthenticated cashiers
create policy "Allow staff login lookup"
on public.staff_accounts for select
to anon
using (true);

-- 2. Secure RPC function for staff login
create or replace function public.authenticate_staff(
  p_staff_id text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
  v_biz record;
begin
  select * into v_staff
  from public.staff_accounts
  where upper(trim(staff_id)) = upper(trim(p_staff_id))
  limit 1;

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
      'phone', coalesce(v_biz.phone, '')
    )
  );
end;
$$;

grant execute on function public.authenticate_staff(text, text) to anon, authenticated;
