create table if not exists public.flixo_agent_tasks (
  task_id text primary key,
  conversation_id text not null check (char_length(trim(conversation_id)) between 1 and 256),
  owner_id text not null check (char_length(trim(owner_id)) between 1 and 256),
  lifecycle text not null check (lifecycle = any (array['QUEUED','PLANNED','AWAITING_CONFIRMATION','RUNNING','VERIFYING','RECOVERING','RESUMED','COMPLETED','FAILED','CANCELLED'])),
  state text not null check (state = any (array['IDLE','NEEDS_INPUT','PLANNED','AWAITING_CONFIRMATION','EXECUTING','VERIFYING','RECOVERING','COMPLETED','FAILED','CANCELLED'])),
  revision integer not null default 0 check (revision >= 0 and revision <= 100000),
  confirmation_required boolean not null default false,
  resume_count integer not null default 0 check (resume_count >= 0 and resume_count <= 1000),
  request text,
  plan jsonb,
  runtime jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flixo_agent_task_events (
  event_id uuid primary key,
  task_id text not null references public.flixo_agent_tasks(task_id) on delete cascade,
  sequence bigint not null check (sequence > 0),
  event_type text not null check (event_type = any (array['chat.message','agent.plan','agent.decision','approval.requested','approval.granted','approval.denied','workflow.started','workflow.step','execution.started','execution.finished','execution.failed','task.cancelled','system'])),
  source text not null check (source = any (array['USER_MESSAGE','FILE_UPLOAD','SCHEDULE','WEBHOOK','TOOL_RESULT','SYSTEM'])),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  previous_hash text,
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (task_id, sequence),
  unique (task_id, idempotency_key)
);

create index if not exists flixo_agent_tasks_conversation_idx on public.flixo_agent_tasks (conversation_id, updated_at desc);
create index if not exists flixo_agent_tasks_owner_idx on public.flixo_agent_tasks (owner_id, updated_at desc);
create index if not exists flixo_agent_task_events_task_time_idx on public.flixo_agent_task_events (task_id, created_at desc);

alter table public.flixo_agent_tasks enable row level security;
alter table public.flixo_agent_task_events enable row level security;

revoke all on table public.flixo_agent_tasks from anon, authenticated;
revoke all on table public.flixo_agent_task_events from anon, authenticated;
grant select, insert, update, delete on table public.flixo_agent_tasks to service_role;
grant select, insert, update, delete on table public.flixo_agent_task_events to service_role;

create or replace function public.flixo_agent_tasks_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists flixo_agent_tasks_updated_at on public.flixo_agent_tasks;
create trigger flixo_agent_tasks_updated_at
before update on public.flixo_agent_tasks
for each row execute function public.flixo_agent_tasks_set_updated_at();
