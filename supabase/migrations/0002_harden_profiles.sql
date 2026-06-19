-- 0002_harden_profiles.sql
-- Tighten the profiles self-UPDATE policy so authenticated users cannot
-- escalate privilege by changing their own `role` or flip `is_active`.
-- These two columns can only be modified through the service_role admin API
-- (which bypasses RLS) — i.e. via /api/admin/users routes (§9.1).
--
-- Strategy:
--   - Drop the broad `profiles_update_self` policy from 0001.
--   - Recreate it with a WITH CHECK that requires `role` and `is_active` of
--     the NEW row to equal the CURRENT (old) values for the same id. Other
--     columns (full_name, timezone, email) remain freely editable by the user.
--   - The subqueries read the user's own profile row, which is permitted by
--     the existing `profiles_select_self_or_admin` SELECT policy — no
--     recursion because that policy uses the SECURITY DEFINER `is_admin()`
--     helper for the admin branch and a simple `auth.uid() = id` predicate
--     for the self branch.
--   - `service_role` bypasses RLS entirely, so /api/admin/users keeps working.

drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (
    select role from public.profiles where id = auth.uid()
  )
  and is_active = (
    select is_active from public.profiles where id = auth.uid()
  )
);

