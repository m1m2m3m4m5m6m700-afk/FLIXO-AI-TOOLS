create table if not exists public.flixo_agent_schedules (
  schedule_id text primary key,
  owner_id text not null,
  conversation_id text,
  locale text not null default 'en',
  prompt text not null,
  next_run_at timestamptz not null,
  interval_seconds integer,
  max_runs integer,
  run_count integer not null default 0,
  active boolean not null default true,
  last_run_at timestamptz,
  last_event_id text,
  lease_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flixo_agent_schedules_schedule_id_check check (char_length(trim(schedule_id)) between 1 and 256),
  constraint flixo_agent_schedules_owner_id_check check (char_length(trim(owner_id)) between 1 and 256),
  constraint flixo_agent_schedules_locale_check check (char_length(trim(locale)) between 2 and 16),
  constraint flixo_agent_schedules_prompt_check check (char_length(trim(prompt)) between 1 and 12000),
  constraint flixo_agent_schedules_interval_check check (interval_seconds is null or interval_seconds between 60 and 31536000),
  constraint flixo_agent_schedules_max_runs_check check (max_runs is null or max_runs between 1 and 100000),
  constraint flixo_agent_schedules_run_count_check check (run_count >= 0),
  constraint flixo_agent_schedules_metadata_check check (jsonb_typeof(metadata) = 'object')
);

alter table public.flixo_agent_schedules enable row level security;
revoke all on public.flixo_agent_schedules from anon, authenticated;
grant select, insert, update, delete on public.flixo_agent_schedules to service_role;

create index if not exists flixo_agent_schedules_due_idx
  on public.flixo_agent_schedules (active, next_run_at);

create or replace function public.flixo_agent_schedules_set_updated_at()
returns trigger language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flixo_agent_schedules_updated_at on public.flixo_agent_schedules;
create trigger flixo_agent_schedules_updated_at
before update on public.flixo_agent_schedules
for each row execute function public.flixo_agent_schedules_set_updated_at();

create or replace function public.flixo_claim_due_agent_schedules(
  p_limit integer default 16,
  p_now timestamptz default now()
)
returns setof public.flixo_agent_schedules
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  row_record public.flixo_agent_schedules%rowtype;
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'SCHEDULE_LIMIT_INVALID';
  end if;

  for row_record in
    select *
    from public.flixo_agent_schedules
    where active = true
      and next_run_at <= p_now
      and (lease_until is null or lease_until <= p_now)
    order by next_run_at asc
    limit p_limit
    for update skip locked
  loop
    update public.flixo_agent_schedules
      set lease_until = p_now + interval '5 minutes'
      where schedule_id = row_record.schedule_id
      returning * into row_record;
    return next row_record;
  end loop;
end;
$$;

revoke all on function public.flixo_claim_due_agent_schedules(integer, timestamptz) from public;
grant execute on function public.flixo_claim_due_agent_schedules(integer, timestamptz) to service_role;
