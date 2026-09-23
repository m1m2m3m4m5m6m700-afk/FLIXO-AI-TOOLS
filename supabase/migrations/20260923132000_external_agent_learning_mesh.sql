create table if not exists public.flixo_agent_learning_events (
  learning_id uuid primary key default gen_random_uuid(),
  source_agent text not null,
  source_role text not null,
  kind text not null check (kind in ('LESSON','ANTI_LESSON','ADVICE','COUNTEREXAMPLE')),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','VERIFIED','BLOCKED','SUPERSEDED')),
  task_id text not null,
  target_sha text not null check (target_sha ~ '^[0-9a-f]{40}$'),
  claim text not null,
  content text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_green boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists flixo_agent_learning_events_fingerprint_uq
  on public.flixo_agent_learning_events (fingerprint);

create index if not exists flixo_agent_learning_events_target_sha_idx
  on public.flixo_agent_learning_events (target_sha, created_at desc);

create index if not exists flixo_agent_learning_events_status_idx
  on public.flixo_agent_learning_events (status, created_at desc);

alter table public.flixo_agent_learning_events enable row level security;

revoke all on table public.flixo_agent_learning_events from anon, authenticated;
grant select, insert, update on table public.flixo_agent_learning_events to service_role;

drop policy if exists flixo_agent_learning_events_service_only on public.flixo_agent_learning_events;
create policy flixo_agent_learning_events_service_only
on public.flixo_agent_learning_events
for all to service_role
using (true)
with check (true);
