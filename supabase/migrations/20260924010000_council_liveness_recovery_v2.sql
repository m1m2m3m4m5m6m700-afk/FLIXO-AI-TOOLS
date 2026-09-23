-- Council liveness/recovery hardening v2.
-- Invariants:
--   1) expired LEASED/ACKED work never remains open forever;
--   2) recovery alternates primary/fallback until bounded exhaustion, then terminal FAILED + handoff evidence;
--   3) watchdog HEALTHY requires zero expired open leases and fresh residency evidence;
--   4) privileged wake/recovery RPCs are service_role-only.

create index if not exists flix_council_dispatches_expired_open_idx
  on public.flix_council_dispatches (status, lease_expires_at, attempts, updated_at);

update public.flix_council_accounts
set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{residencyRequired}', 'true'::jsonb, true),
    updated_at = now()
where account_id in ('CHIEF','WORKER_A','WORKER_B')
  and coalesce(metadata->>'residencyRequired', 'false') <> 'true';

alter table public.flix_council_accounts
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists current_execution_sha text;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'flix_council_accounts_current_execution_sha_chk'
       and conrelid = 'public.flix_council_accounts'::regclass
  ) then
    alter table public.flix_council_accounts
      add constraint flix_council_accounts_current_execution_sha_chk
      check (current_execution_sha is null or current_execution_sha ~ '^[0-9a-f]{40}$');
  end if;
end
$block$;

create or replace function public.council_recover_expired_dispatches(p_limit integer default 10)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_dispatch public.flix_council_dispatches%rowtype;
  v_next_account text;
  v_lease_seconds integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'COUNCIL_RECOVER_LIMIT_INVALID';
  end if;

  for v_dispatch in
    select *
      from public.flix_council_dispatches
     where status in ('LEASED','ACKED')
       and lease_expires_at is not null
       and lease_expires_at <= now()
     order by lease_expires_at asc, created_at asc
     for update skip locked
     limit p_limit
  loop
    insert into public.flix_council_events(
      dispatch_id, account_id, event_type, exact_sha, payload
    ) values (
      v_dispatch.dispatch_id,
      v_dispatch.recipient_account_id,
      'EXPIRED',
      v_dispatch.entry_sha,
      jsonb_build_object(
        'previousStatus', v_dispatch.status,
        'previousSessionId', v_dispatch.session_id,
        'attempt', v_dispatch.attempts,
        'recoveryVersion', 'v2', 'recoveryState', 'EXPIRED'
      )
    );

    if v_dispatch.attempts >= 20 then
      update public.flix_council_dispatches
         set status = 'FAILED',
             session_id = null,
             lease_expires_at = null,
             last_error = 'LEASE_RECOVERY_ATTEMPTS_EXHAUSTED',
             completed_at = now(),
             updated_at = now()
       where dispatch_id = v_dispatch.dispatch_id
      returning * into v_dispatch;

      insert into public.flix_council_events(
        dispatch_id, account_id, event_type, exact_sha, payload
      ) values (
        v_dispatch.dispatch_id,
        v_dispatch.recipient_account_id,
        'FAILED',
        v_dispatch.entry_sha,
        jsonb_build_object(
          'reason', 'LEASE_RECOVERY_ATTEMPTS_EXHAUSTED',
          'attempts', v_dispatch.attempts,
          'terminal', true,
          'recoveryVersion', 'v2',
          'recoveryState', 'FAILED_TERMINAL'
        )
      );

      insert into public.flix_council_events(
        dispatch_id, account_id, event_type, exact_sha, payload
      ) values (
        v_dispatch.dispatch_id,
        v_dispatch.handoff_account_id,
        'HANDOFF_READY',
        v_dispatch.entry_sha,
        jsonb_build_object(
          'reason', 'LEASE_RECOVERY_ATTEMPTS_EXHAUSTED',
          'sourceAccountId', v_dispatch.recipient_account_id,
          'attempts', v_dispatch.attempts,
          'terminal', true,
          'requiredAction', 'SUPERVISOR_ESCALATION',
          'recoveryState', 'FAILED_TERMINAL'
        )
      );

      return next v_dispatch;
      continue;
    end if;

    v_next_account := case
      when v_dispatch.recipient_account_id = v_dispatch.primary_account_id
        then v_dispatch.fallback_account_id
      when v_dispatch.recipient_account_id = v_dispatch.fallback_account_id
        then v_dispatch.primary_account_id
      else v_dispatch.fallback_account_id
    end;

    select lease_seconds into v_lease_seconds
      from public.flix_council_accounts
     where account_id = v_next_account
       and active = true
     for update;

    if not found then
      update public.flix_council_dispatches
         set status = 'FAILED',
             session_id = null,
             lease_expires_at = null,
             last_error = 'FALLBACK_ACCOUNT_INACTIVE',
             completed_at = now(),
             updated_at = now()
       where dispatch_id = v_dispatch.dispatch_id
      returning * into v_dispatch;

      insert into public.flix_council_events(
        dispatch_id, account_id, event_type, exact_sha, payload
      ) values (
        v_dispatch.dispatch_id,
        v_dispatch.handoff_account_id,
        'HANDOFF_READY',
        v_dispatch.entry_sha,
        jsonb_build_object(
          'reason', 'FALLBACK_ACCOUNT_INACTIVE',
          'terminal', true,
          'requiredAction', 'SUPERVISOR_ESCALATION',
          'recoveryState', 'BLOCKED'
        )
      );

      return next v_dispatch;
      continue;
    end if;

    update public.flix_council_dispatches
       set recipient_account_id = v_next_account,
           status = 'LEASED',
           session_id = null,
           lease_expires_at = now() + make_interval(secs => v_lease_seconds),
           attempts = attempts + 1,
           last_error = 'LEASE_EXPIRED_RECOVERY',
           updated_at = now()
     where dispatch_id = v_dispatch.dispatch_id
    returning * into v_dispatch;

    insert into public.flix_council_events(
      dispatch_id, account_id, event_type, exact_sha, payload
    ) values (
      v_dispatch.dispatch_id,
      v_dispatch.recipient_account_id,
      'DISPATCHED',
      v_dispatch.entry_sha,
      jsonb_build_object(
        'attempt', v_dispatch.attempts,
        'fallback', true,
        'automatic', true,
        'recoveryVersion', 'v2',
        'previousAccountId', v_dispatch.primary_account_id,
        'recoveryState', 'RECOVERED'
      )
    );

    return next v_dispatch;
  end loop;
end;
$function$;

create or replace function public.council_claim_dispatch(p_account_id text)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_dispatch public.flix_council_dispatches%rowtype;
  v_session_id text;
begin
  if p_account_id not in ('CHIEF','WORKER_A','WORKER_B') then
    raise exception 'COUNCIL_ACCOUNT_INVALID';
  end if;

  perform 1
    from public.flix_council_accounts
   where account_id = p_account_id
     and active = true
   for update;
  if not found then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  update public.flix_council_dispatches
     set status = 'FAILED',
         session_id = null,
         lease_expires_at = null,
         last_error = 'LEASE_RECOVERY_ATTEMPTS_EXHAUSTED',
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where status in ('LEASED','ACKED')
     and lease_expires_at is not null
     and lease_expires_at <= now()
     and attempts >= 20;

  select *
    into v_dispatch
    from public.flix_council_dispatches
   where recipient_account_id = p_account_id
     and status = 'LEASED'
     and session_id is null
     and lease_expires_at is not null
     and lease_expires_at > now()
   order by created_at asc
   for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  v_session_id := gen_random_uuid()::text;

  update public.flix_council_dispatches
     set session_id = v_session_id,
         updated_at = now()
   where dispatch_id = v_dispatch.dispatch_id
  returning * into v_dispatch;

  update public.flix_council_accounts
     set current_session_id = v_session_id,
         last_seen_at = now(),
         last_heartbeat_at = now(),
         current_execution_sha = v_dispatch.entry_sha,
         updated_at = now()
   where account_id = p_account_id;

  insert into public.flix_council_events(
    dispatch_id, account_id, event_type, exact_sha, payload
  ) values (
    v_dispatch.dispatch_id,
    p_account_id,
    'HEARTBEAT',
    v_dispatch.entry_sha,
    jsonb_build_object('source', 'COUNCIL_CLAIM', 'sessionId', v_session_id)
  );

  return next v_dispatch;
end;
$function$;

create or replace function public.flixo_automation_watchdog_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_recovered integer := 0;
  v_remaining_expired integer := 0;
  v_stale_accounts integer := 0;
  v_state text;
  v_previous_state text;
  v_error text := null;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('FLIXO_AUTOMATION_WATCHDOG_V2', 0)) then
    return jsonb_build_object('ok', true, 'status', 'ALREADY_RUNNING', 'at', v_now);
  end if;

  select state
    into v_previous_state
    from public.flixo_automation_watchdog
   where id = 1
   for update;

  begin
    select count(*)::integer
      into v_recovered
      from public.council_recover_expired_dispatches(25);

    select count(*)::integer
      into v_remaining_expired
      from public.flix_council_dispatches
     where status in ('LEASED','ACKED')
       and lease_expires_at is not null
       and lease_expires_at <= v_now;

    select count(*)::integer
      into v_stale_accounts
      from public.flix_council_accounts
     where active = true
       and coalesce(metadata->>'residencyRequired', 'false') = 'true'
       and (
         last_seen_at is null
         or last_seen_at < v_now - make_interval(secs => greatest(120, lease_seconds * 2))
       );

    v_state := case
      when v_remaining_expired > 0 or v_stale_accounts > 0 then 'DEGRADED'
      when v_recovered > 0 then 'RECOVERING'
      else 'HEALTHY'
    end;

    update public.flixo_automation_watchdog
       set state = v_state,
           last_tick_at = v_now,
           last_recovery_at = case when v_recovered > 0 then v_now else last_recovery_at end,
           last_recovery_count = v_recovered,
           consecutive_failures = 0,
           last_error = null,
           evidence = jsonb_build_object(
             'protocol', 'FLIXO-AUTOMATION-WATCHDOG-v2',
             'repository', repository,
             'branch', branch,
             'leaseRecoveryAuthority', 'public.council_recover_expired_dispatches',
             'recoveredCount', v_recovered,
             'remainingExpiredOpenLeases', v_remaining_expired,
             'staleResidentAccounts', v_stale_accounts,
             'checkedAt', v_now,
             'healthyRequires', jsonb_build_array('zero expired open leases', 'zero stale resident accounts')
           ),
           updated_at = v_now
     where id = 1;

    insert into public.flixo_automation_watchdog_events(
      watchdog_id,event_type,state,recovered_count,metadata
    ) values (
      1,
      case
        when v_recovered > 0 then 'LEASE_RECOVERY'
        else 'TICK'
      end,
      v_state,
      v_recovered,
      jsonb_build_object(
        'at', v_now,
        'previousState', v_previous_state,
        'remainingExpiredOpenLeases', v_remaining_expired,
        'staleResidentAccounts', v_stale_accounts,
        'recoveryMode', 'BOUNDED_RECOVERY_V2'
      )
    );

    if v_previous_state is distinct from v_state then
      insert into public.flixo_automation_watchdog_events(
        watchdog_id,event_type,state,recovered_count,metadata
      ) values (
        1,'STATE_CHANGE',v_state,v_recovered,
        jsonb_build_object(
          'from',v_previous_state,
          'to',v_state,
          'at',v_now,
          'remainingExpiredOpenLeases', v_remaining_expired,
          'staleResidentAccounts', v_stale_accounts
        )
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', v_state,
      'recoveredCount', v_recovered,
      'remainingExpiredOpenLeases', v_remaining_expired,
      'staleResidentAccounts', v_stale_accounts,
      'at', v_now
    );
  exception when others then
    v_error := sqlerrm;
    update public.flixo_automation_watchdog
       set state='DEGRADED',
           last_tick_at=v_now,
           consecutive_failures=consecutive_failures+1,
           last_error=left(v_error,2000),
           evidence=jsonb_build_object(
             'protocol','FLIXO-AUTOMATION-WATCHDOG-v2',
             'failure',v_error,
             'at',v_now,
             'recoveryAuthority','COUNCIL_RECOVERY_RPC'
           ),
           updated_at=v_now
     where id=1;

    insert into public.flixo_automation_watchdog_events(
      watchdog_id,event_type,state,recovered_count,metadata
    ) values (
      1,'FAILURE','DEGRADED',0,jsonb_build_object(
        'at',v_now,'error',left(v_error,2000)
      )
    );

    return jsonb_build_object(
      'ok',false,
      'status','DEGRADED',
      'error',v_error,
      'at',v_now
    );
  end;
end;
$$;

revoke all on function public.council_claim_dispatch(text) from public, anon, authenticated;
revoke all on function public.council_recover_expired_dispatches(integer) from public, anon, authenticated;
revoke all on function public.flixo_automation_watchdog_tick() from public, anon, authenticated;
revoke all on function public.flixo_retry_pending_assistant_wakes() from public, anon, authenticated;
revoke all on function public.flixo_auto_wake_stale_master3() from public, anon, authenticated;

grant execute on function public.council_claim_dispatch(text) to service_role;
grant execute on function public.council_recover_expired_dispatches(integer) to service_role;
grant execute on function public.flixo_automation_watchdog_tick() to service_role;
grant execute on function public.flixo_retry_pending_assistant_wakes() to service_role;
grant execute on function public.flixo_auto_wake_stale_master3() to service_role;

do $block$
declare
  jid bigint;
begin
  select jobid into jid
    from cron.job
   where jobname in ('flixo-council-lease-recovery','flixo-council-lease-recovery-v2')
   order by case when jobname = 'flixo-council-lease-recovery-v2' then 0 else 1 end
   limit 1;
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
  perform cron.schedule(
    'flixo-council-lease-recovery-v2',
    '* * * * *',
    $$select count(*) from public.council_recover_expired_dispatches(25);$$
  );
end;
$block$;
