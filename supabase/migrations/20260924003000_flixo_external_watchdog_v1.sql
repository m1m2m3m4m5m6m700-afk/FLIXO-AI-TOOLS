-- FLIXO Automation Watchdog v1
-- External-to-GitHub liveness and deterministic lease recovery plane.
-- No source mutation authority. No GREEN/certification authority.

create table if not exists public.flixo_automation_watchdog (
  id smallint primary key check (id = 1),
  protocol_version text not null default 'FLIXO-AUTOMATION-WATCHDOG-v1',
  repository text not null default 'm1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS',
  branch text not null default 'execution' check (branch = 'execution'),
  enabled boolean not null default true,
  cadence_seconds integer not null default 60 check (cadence_seconds between 30 and 300),
  state text not null default 'BOOTING' check (state in ('BOOTING','HEALTHY','RECOVERING','DEGRADED','BLOCKED_EXTERNAL')),
  last_tick_at timestamptz,
  last_recovery_at timestamptz,
  last_recovery_count integer not null default 0 check (last_recovery_count >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error text,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.flixo_automation_watchdog (id) values (1) on conflict (id) do nothing;

create table if not exists public.flixo_automation_watchdog_events (
  event_id uuid primary key default gen_random_uuid(),
  watchdog_id smallint not null references public.flixo_automation_watchdog(id) on delete cascade,
  event_type text not null check (event_type in ('TICK','LEASE_RECOVERY','RECOVERY_EMPTY','FAILURE','STATE_CHANGE')),
  state text not null check (state in ('BOOTING','HEALTHY','RECOVERING','DEGRADED','BLOCKED_EXTERNAL')),
  recovered_count integer not null default 0 check (recovered_count >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.flixo_automation_watchdog enable row level security;
alter table public.flixo_automation_watchdog_events enable row level security;
revoke all on table public.flixo_automation_watchdog from anon, authenticated;
revoke all on table public.flixo_automation_watchdog_events from anon, authenticated;

create or replace function public.flixo_automation_watchdog_tick()
returns jsonb language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_recovered integer := 0;
  v_state text;
  v_previous_state text;
  v_error text := null;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('FLIXO_AUTOMATION_WATCHDOG_V1', 0)) then
    return jsonb_build_object('ok', true, 'status', 'ALREADY_RUNNING', 'at', v_now);
  end if;
  select state into v_previous_state from public.flixo_automation_watchdog where id = 1 for update;
  begin
    select count(*)::integer into v_recovered from public.council_recover_expired_dispatches(25);
    v_state := case when v_recovered > 0 then 'RECOVERING' else 'HEALTHY' end;
    update public.flixo_automation_watchdog set
      state = v_state,
      last_tick_at = v_now,
      last_recovery_at = case when v_recovered > 0 then v_now else last_recovery_at end,
      last_recovery_count = v_recovered,
      consecutive_failures = 0,
      last_error = null,
      evidence = jsonb_build_object('protocol','FLIXO-AUTOMATION-WATCHDOG-v1','repository',repository,'branch',branch,'leaseRecoveryAuthority','public.council_recover_expired_dispatches','recoveredCount',v_recovered,'checkedAt',v_now),
      updated_at = v_now
    where id = 1;
    insert into public.flixo_automation_watchdog_events(watchdog_id,event_type,state,recovered_count,metadata)
    values(1,case when v_recovered > 0 then 'LEASE_RECOVERY' else 'TICK' end,v_state,v_recovered,jsonb_build_object('at',v_now,'previousState',v_previous_state,'recoveryMode','DETERMINISTIC_SINGLE_PASS'));
    if v_previous_state is distinct from v_state then
      insert into public.flixo_automation_watchdog_events(watchdog_id,event_type,state,recovered_count,metadata)
      values(1,'STATE_CHANGE',v_state,v_recovered,jsonb_build_object('from',v_previous_state,'to',v_state,'at',v_now));
    end if;
    return jsonb_build_object('ok',true,'status',v_state,'recoveredCount',v_recovered,'at',v_now);
  exception when others then
    v_error := sqlerrm;
    update public.flixo_automation_watchdog set state='DEGRADED',last_tick_at=v_now,consecutive_failures=consecutive_failures+1,last_error=left(v_error,2000),evidence=jsonb_build_object('protocol','FLIXO-AUTOMATION-WATCHDOG-v1','failure',v_error,'at',v_now,'recoveryAuthority','COUNCIL_RECOVERY_RPC'),updated_at=v_now where id=1;
    insert into public.flixo_automation_watchdog_events(watchdog_id,event_type,state,recovered_count,metadata) values(1,'FAILURE','DEGRADED',0,jsonb_build_object('at',v_now,'error',left(v_error,2000)));
    return jsonb_build_object('ok',false,'status','DEGRADED','error',v_error,'at',v_now);
  end;
end;
$$;

revoke all on function public.flixo_automation_watchdog_tick() from public, anon, authenticated;
grant execute on function public.flixo_automation_watchdog_tick() to service_role;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='flixo-automation-watchdog-v1' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('flixo-automation-watchdog-v1','* * * * *','select public.flixo_automation_watchdog_tick();');
end $$;
