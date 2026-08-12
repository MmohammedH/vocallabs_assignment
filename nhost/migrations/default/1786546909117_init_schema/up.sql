-- =============================================================================
-- AI Agent Workflow Builder — initial schema
-- =============================================================================

create extension if not exists pgcrypto;

-- ORGANIZATIONS ---------------------------------------------------------------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  quota_calls_allowed integer not null default 1000,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ORG_MEMBERS -------------------------------------------------------------------
create table public.org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index idx_org_members_user on public.org_members(user_id);
create index idx_org_members_org  on public.org_members(org_id);

create function public.prevent_last_owner_removal() returns trigger as $$
begin
  if (old.role = 'owner' and (new is null or new.role <> 'owner')) then
    if (select count(*) from public.org_members where org_id = old.org_id and role = 'owner') <= 1 then
      raise exception 'cannot remove the last owner of an organization';
    end if;
  end if;
  return new;
end; $$ language plpgsql;

create trigger trg_prevent_last_owner_removal
  before update or delete on public.org_members
  for each row execute function public.prevent_last_owner_removal();

-- WORKFLOWS ---------------------------------------------------------------------
create table public.workflows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_workflows_org on public.workflows(org_id);

-- WORKFLOW_STEPS ------------------------------------------------------------------
create table public.workflow_steps (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id      uuid not null,
  step_order  integer not null,
  name        text,
  type        text not null check (type in
                ('llm_call','http_request','db_write','notify','conditional_branch','approval_gate')),
  config      jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workflow_id, step_order)
);
create index idx_workflow_steps_workflow on public.workflow_steps(workflow_id);

create function public.set_org_id_from_workflow() returns trigger as $$
begin
  select org_id into new.org_id from public.workflows where id = new.workflow_id;
  return new;
end; $$ language plpgsql;

create trigger trg_workflow_steps_org_id
  before insert or update on public.workflow_steps
  for each row execute function public.set_org_id_from_workflow();

-- WORKFLOW_TRIGGERS -----------------------------------------------------------------
create table public.workflow_triggers (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id      uuid not null,
  type        text not null check (type in ('manual','webhook','scheduled','database_event')),
  config      jsonb not null default '{}',
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_workflow_triggers_workflow on public.workflow_triggers(workflow_id);

create trigger trg_workflow_triggers_org_id
  before insert or update on public.workflow_triggers
  for each row execute function public.set_org_id_from_workflow();

-- WORKFLOW_RUNS -----------------------------------------------------------------------
create table public.workflow_runs (
  id                 uuid primary key default gen_random_uuid(),
  workflow_id        uuid not null references public.workflows(id) on delete cascade,
  org_id             uuid not null,
  triggered_by       uuid references auth.users(id),
  trigger_type       text not null check (trigger_type in ('manual','webhook','scheduled','database_event')),
  status             text not null check (status in ('pending','running','paused','completed','failed','cancelled'))
                        default 'pending',
  current_step_order integer,
  input              jsonb,
  output             jsonb,
  error              text,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index idx_workflow_runs_workflow on public.workflow_runs(workflow_id);
create index idx_workflow_runs_org      on public.workflow_runs(org_id, status);

create trigger trg_workflow_runs_org_id
  before insert on public.workflow_runs
  for each row execute function public.set_org_id_from_workflow();

-- STEP_RUNS -----------------------------------------------------------------------------
create table public.step_runs (
  id               uuid primary key default gen_random_uuid(),
  workflow_run_id  uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id),
  org_id           uuid not null,
  step_order       integer not null,
  type             text not null,
  status           text not null check (status in
                     ('pending','running','succeeded','failed','paused','skipped')) default 'pending',
  input            jsonb,
  output           jsonb,
  error            text,
  attempt_count    integer not null default 0,
  approved_by      uuid references auth.users(id),
  approved_at      timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index idx_step_runs_run on public.step_runs(workflow_run_id, step_order);
create index idx_step_runs_org on public.step_runs(org_id);

create function public.set_org_id_from_run() returns trigger as $$
begin
  select org_id into new.org_id from public.workflow_runs where id = new.workflow_run_id;
  return new;
end; $$ language plpgsql;

create trigger trg_step_runs_org_id
  before insert on public.step_runs
  for each row execute function public.set_org_id_from_run();

-- WORKFLOW_OUTPUTS (db_write sink) --------------------------------------------------------
create table public.workflow_outputs (
  id              uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  step_run_id     uuid not null references public.step_runs(id) on delete cascade,
  org_id          uuid not null,
  key             text not null,
  value           jsonb not null,
  created_at      timestamptz not null default now()
);
create index idx_workflow_outputs_run on public.workflow_outputs(workflow_run_id);

create function public.set_org_id_from_step_run() returns trigger as $$
begin
  select org_id into new.org_id from public.step_runs where id = new.step_run_id;
  return new;
end; $$ language plpgsql;

create trigger trg_workflow_outputs_org_id
  before insert on public.workflow_outputs
  for each row execute function public.set_org_id_from_step_run();

-- NOTIFICATIONS (notify-step / event-trigger handoff) ------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  step_run_id uuid not null references public.step_runs(id) on delete cascade,
  org_id      uuid not null,
  channel     text not null check (channel in ('slack','email')),
  target      text not null,
  payload     jsonb not null,
  status      text not null check (status in ('pending','sent','failed')) default 'pending',
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_notifications_status on public.notifications(status);

create trigger trg_notifications_org_id
  before insert on public.notifications
  for each row execute function public.set_org_id_from_step_run();

-- ORG_USAGE_COUNTERS (atomic quota ledger) -----------------------------------------------
create table public.org_usage_counters (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  calls_used  integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (org_id, period_start)
);

-- LEAD_INTAKE (Database Event trigger demo watched table) -------------------------------
create table public.lead_intake (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id),
  email       text not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index idx_lead_intake_workflow on public.lead_intake(workflow_id);

-- VIEWS: aggregations -----------------------------------------------------------------------
create view public.org_usage_this_month as
select
  o.id                    as org_id,
  o.name                  as org_name,
  o.quota_calls_allowed,
  coalesce(u.calls_used, 0)                         as calls_used,
  o.quota_calls_allowed - coalesce(u.calls_used, 0)  as calls_remaining
from public.organizations o
left join public.org_usage_counters u
  on u.org_id = o.id
 and u.period_start = date_trunc('month', now())::date;

create view public.org_run_stats as
select
  w.org_id,
  wr.workflow_id,
  count(*) as total_runs,
  avg(extract(epoch from (wr.completed_at - wr.started_at))) as avg_duration_seconds
from public.workflow_runs wr
join public.workflows w on w.id = wr.workflow_id
where wr.completed_at is not null
group by w.org_id, wr.workflow_id;

-- updated_at maintenance -------------------------------------------------------------------
create function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

create trigger trg_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger trg_workflows_updated_at before update on public.workflows
  for each row execute function public.set_updated_at();
create trigger trg_workflow_steps_updated_at before update on public.workflow_steps
  for each row execute function public.set_updated_at();
create trigger trg_workflow_triggers_updated_at before update on public.workflow_triggers
  for each row execute function public.set_updated_at();
