drop view if exists public.org_run_stats;
drop view if exists public.org_usage_this_month;

drop table if exists public.lead_intake;
drop table if exists public.org_usage_counters;
drop table if exists public.notifications;
drop table if exists public.workflow_outputs;
drop table if exists public.step_runs;
drop table if exists public.workflow_runs;
drop table if exists public.workflow_triggers;
drop table if exists public.workflow_steps;
drop table if exists public.workflows;
drop table if exists public.org_members;
drop table if exists public.organizations;

drop function if exists public.set_updated_at();
drop function if exists public.set_org_id_from_step_run();
drop function if exists public.set_org_id_from_run();
drop function if exists public.set_org_id_from_workflow();
drop function if exists public.prevent_last_owner_removal();
