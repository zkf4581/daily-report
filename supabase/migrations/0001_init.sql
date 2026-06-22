-- 0001_init.sql
-- Initial schema for the daily-report app.
-- Tables: profiles, reports, app_settings, reminder_log.
-- Plus is_admin() helper, auth.users → profiles trigger, reports.updated_at
-- trigger, and full Row Level Security policies per 需求与技术方案.md §7.

create extension if not exists pgcrypto;

-- =============================================================================
-- profiles (1:1 with auth.users)
-- =============================================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'contractor'
              check (role in ('admin', 'contractor')),
  is_active   boolean not null default true,
  timezone    text not null default 'Asia/Shanghai',
  created_at  timestamptz not null default now()
);

-- AFTER INSERT trigger on auth.users → create matching profiles row.
-- role is taken from raw_app_meta_data->>'role' (defaults to 'contractor').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data ->> 'role', 'contractor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =============================================================================
-- reports
-- =============================================================================
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  report_date    date not null,
  done           text not null,
  blockers       text,
  tomorrow_plan  text,
  minutes_spent  integer check (minutes_spent >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, report_date)
);

create index reports_report_date_idx on public.reports (report_date);
create index reports_user_date_idx   on public.reports (user_id, report_date desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- =============================================================================
-- app_settings (single-row config table)
-- =============================================================================
create table public.app_settings (
  id                   integer primary key default 1 check (id = 1),
  reminder_hour        integer not null default 21
                       check (reminder_hour between 0 and 23),
  notify_admin_digest  boolean not null default true,
  updated_at           timestamptz not null default now()
);

-- Seed the single config row.
insert into public.app_settings (id, reminder_hour, notify_admin_digest)
values (1, 21, true)
on conflict (id) do nothing;

-- =============================================================================
-- reminder_log (email-sending idempotency, used by P6)
-- =============================================================================
create table public.reminder_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  report_date   date not null,
  sent_at       timestamptz not null default now(),
  unique (user_id, report_date)
);

-- =============================================================================
-- is_admin() helper — SECURITY DEFINER so it bypasses profiles RLS
-- (prevents the classic "profiles policy queries profiles" recursion).
-- =============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active
  );
$$;



-- =============================================================================
-- RLS: profiles (§7.5)
-- =============================================================================
alter table public.profiles enable row level security;

-- SELECT: self OR admin
create policy profiles_select_self_or_admin
on public.profiles for select
to authenticated
using (auth.uid() = id or public.is_admin());

-- UPDATE: only self (admin updates role/is_active flow through service_role,
-- which bypasses RLS).
create policy profiles_update_self
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- INSERT / DELETE: no policies (handled by the auth.users trigger and by
-- service_role-only admin routes).

-- =============================================================================
-- RLS: reports (§7.5)
-- The INSERT/UPDATE policies enforce "report_date must equal today in the
-- author's own timezone". This is the real "today-only edit, past locked"
-- boundary — the UI can only hint at it; the DB enforces it.
-- =============================================================================
alter table public.reports enable row level security;

-- SELECT: own rows OR admin
create policy reports_select_self_or_admin
on public.reports for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- INSERT: must be self, and report_date must be today in the author's tz
create policy reports_insert_self_today
on public.reports for insert
to authenticated
with check (
  user_id = auth.uid()
  and report_date = (
    now() at time zone (
      select timezone from public.profiles where id = auth.uid()
    )
  )::date
);

-- UPDATE: USING + WITH CHECK both apply the same "today in own tz" predicate,
-- so past-day rows are immutable from the client side.
create policy reports_update_self_today
on public.reports for update
to authenticated
using (
  user_id = auth.uid()
  and report_date = (
    now() at time zone (
      select timezone from public.profiles where id = auth.uid()
    )
  )::date
)
with check (
  user_id = auth.uid()
  and report_date = (
    now() at time zone (
      select timezone from public.profiles where id = auth.uid()
    )
  )::date
);

-- DELETE: no policy (deletes are not allowed from the client).

-- =============================================================================
-- RLS: app_settings, reminder_log
-- Default-deny: enable RLS without any policies so only service_role
-- (which bypasses RLS) can read or write these tables. This matches §14's
-- security red lines — never rely on the client for permission checks.
-- =============================================================================
alter table public.app_settings  enable row level security;
alter table public.reminder_log  enable row level security;
