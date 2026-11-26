-- Restrict announcement management to the super_admin role.
-- All browser mutations use the role-checked SECURITY DEFINER RPCs.

drop policy if exists "Super admins manage announcements"
  on public.system_announcements;

create policy "Super admins manage announcements"
  on public.system_announcements for all
  to authenticated
  using (public.get_admin_role() = 'super_admin')
  with check (public.get_admin_role() = 'super_admin');

-- Prevent direct REST/table writes from bypassing the narrower admin RPC checks.
revoke insert, update, delete, truncate
  on table public.system_announcements
  from public, anon, authenticated;
