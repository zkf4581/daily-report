-- 0004_metrics_finalize.sql
-- P8b: destructive schema finalize for the configurable metric items feature.
--
-- Ships together with the matching page changes (today / history / admin /
-- admin-people pages drop all references to minutes_spent and make `done`
-- optional). Apply this migration in the same release as those code changes;
-- rolling back code without the migration leaves /admin able to build but
-- /today's old "耗时" field will be missing.
--
-- Changes:
--   1) reports.done becomes nullable (主信息现由 report_metrics 数字承载).
--   2) reports.minutes_spent column is removed (replaced by "模块学习时间"
--      metric_item with unit 小时, seeded in 0003).
--
-- Safety: report_metrics has a composite FK to reports(user_id, report_date)
-- with ON DELETE CASCADE, so existing rows continue to satisfy the new state.

alter table public.reports alter column done drop not null;

alter table public.reports drop column minutes_spent;

