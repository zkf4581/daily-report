-- 0003_metric_items.sql
-- P8a: configurable metric items + per-report numeric values.
--
-- Adds two tables (metric_items, report_metrics) and their RLS policies that
-- mirror reports (own row + today-in-own-tz to write/delete). Seeds the four
-- default metric items from 需求与技术方案.md §P8. NON-DESTRUCTIVE on purpose:
-- the reports.done / reports.minutes_spent column changes are deferred to
-- 0004 (P8b) and shipped together with the matching page changes.

-- =============================================================================
-- metric_items
-- =============================================================================
create table public.metric_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  unit        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index metric_items_sort_idx
  on public.metric_items (sort_order, created_at);

-- =============================================================================
-- report_metrics (per-day numeric values for each metric_item)
-- =============================================================================
create table public.report_metrics (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  report_date     date not null,
  metric_item_id  uuid not null references public.metric_items(id)
                  on delete cascade,
  value           numeric not null check (value >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, report_date, metric_item_id),
  -- Composite FK to the existing unique(user_id, report_date) on reports —
  -- guarantees a row only exists when its parent report exists, and that
  -- deleting the report cascades to its metric rows.
  foreign key (user_id, report_date)
    references public.reports (user_id, report_date)
    on delete cascade
);

create index report_metrics_user_date_idx
  on public.report_metrics (user_id, report_date);
create index report_metrics_item_idx
  on public.report_metrics (metric_item_id);

-- Reuse the set_updated_at() trigger function defined in 0001.
create trigger report_metrics_set_updated_at
before update on public.report_metrics
for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS: metric_items (§7 — admins manage, everyone else reads active config)
-- =============================================================================
alter table public.metric_items enable row level security;

-- SELECT: any authenticated user (contractors need to see active items to fill).
create policy metric_items_select_authenticated
on public.metric_items for select
to authenticated
using (true);

-- INSERT / UPDATE / DELETE: admins only (uses 0001's SECURITY DEFINER helper).
create policy metric_items_insert_admin
on public.metric_items for insert
to authenticated
with check (public.is_admin());

create policy metric_items_update_admin
on public.metric_items for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy metric_items_delete_admin
on public.metric_items for delete
to authenticated
using (public.is_admin());

-- =============================================================================
-- RLS: report_metrics — mirrors reports (own rows; writes/deletes locked to
-- today in the author's own tz). Admins read everything via is_admin().
-- =============================================================================
alter table public.report_metrics enable row level security;

-- SELECT: own rows OR admin
create policy report_metrics_select_self_or_admin
on public.report_metrics for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- INSERT: must be self, and report_date must be today in the author's tz.
create policy report_metrics_insert_self_today
on public.report_metrics for insert
to authenticated
with check (
  user_id = auth.uid()
  and report_date = (
    now() at time zone (
      select timezone from public.profiles where id = auth.uid()
    )
  )::date
);

-- UPDATE: USING + WITH CHECK both apply the "today in own tz" predicate, so
-- past-day rows are immutable from the client side.
create policy report_metrics_update_self_today
on public.report_metrics for update
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

-- DELETE: allow clearing a metric on the same day; past days are locked.
create policy report_metrics_delete_self_today
on public.report_metrics for delete
to authenticated
using (
  user_id = auth.uid()
  and report_date = (
    now() at time zone (
      select timezone from public.profiles where id = auth.uid()
    )
  )::date
);

-- =============================================================================
-- Seed: the four default metric items (idempotent via WHERE NOT EXISTS,
-- since `name` has no unique constraint by design — admins may rename freely).
-- =============================================================================
insert into public.metric_items (name, unit, sort_order, is_active)
select '测试用例编写', '个', 1, true
where not exists (
  select 1 from public.metric_items where name = '测试用例编写'
);

insert into public.metric_items (name, unit, sort_order, is_active)
select '用例测试', '个', 2, true
where not exists (
  select 1 from public.metric_items where name = '用例测试'
);

insert into public.metric_items (name, unit, sort_order, is_active)
select '问题单发现', '条', 3, true
where not exists (
  select 1 from public.metric_items where name = '问题单发现'
);

insert into public.metric_items (name, unit, sort_order, is_active)
select '模块学习时间', '小时', 4, true
where not exists (
  select 1 from public.metric_items where name = '模块学习时间'
);

