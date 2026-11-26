-- Protect privileged subscription and suspension columns on public.businesses
-- Prevents authenticated merchants or managers from escalating privileges, un-suspending
-- themselves, or granting perpetual Pro/Enterprise tiers via direct REST UPDATEs.

create or replace function public.protect_business_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    OLD.plan_tier is distinct from NEW.plan_tier or
    OLD.plan_expires_at is distinct from NEW.plan_expires_at or
    OLD.is_suspended is distinct from NEW.is_suspended or
    OLD.suspended_at is distinct from NEW.suspended_at or
    OLD.suspension_reason is distinct from NEW.suspension_reason
  ) then
    -- If executed in normal authenticated/anon user context without super admin privileges, reject
    if current_user in ('authenticated', 'anon', 'public') and not public.is_super_admin() then
      raise exception 'Unauthorized: Subscription and suspension attributes can only be modified via audited administrative RPCs'
        using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_business_privileged_columns on public.businesses;

create trigger trg_protect_business_privileged_columns
  before update on public.businesses
  for each row
  execute function public.protect_business_privileged_columns();

-- Revoke direct column-level UPDATE on sensitive columns from public, anon, and authenticated
-- All modifications must flow through SECURITY DEFINER RPCs (upgrade_business_plan, admin_override_business_plan, admin_toggle_business_suspension)
revoke update (
  plan_tier,
  plan_expires_at,
  is_suspended,
  suspended_at,
  suspension_reason
) on table public.businesses from public, anon, authenticated;
