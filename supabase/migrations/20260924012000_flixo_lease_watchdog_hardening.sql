-- FLIXO lease/watchdog hardening
-- Disappeared workers never become permanent LEASED zombies.
-- EXPIRED is a recovery terminal state, not a logical task failure.

create or replace function public.council_recover_expired_dispatches(p_limit integer default 10)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  picked public.flix_council_dispatches;
  exhausted public.flix_council_dispatches;
begin
  for exhausted in
    update public.flix_council_dispatches d
       set status='EXPIRED',
           session_id=null,
           lease_expires_at=null,
           last_error='LEASE_RECOVERY_ATTEMPTS_EXHAUSTED_REQUIRES_REDISPATCH',
           updated_at=now()
     where d.status in ('LEASED','ACKED')
       and d.lease_expires_at is not null
       and d.lease_expires_at < now()
       and d.attempts >= 2
     returning d.*
  loop
    insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
    values (
      exhausted.dispatch_id,
      coalesce(exhausted.recipient_account_id, exhausted.fallback_account_id, exhausted.primary_account_id),
      'EXPIRED',
      exhausted.entry_sha,
      jsonb_build_object(
        'reason','LEASE_RECOVERY_ATTEMPTS_EXHAUSTED_REQUIRES_REDISPATCH',
        'attempts',exhausted.attempts,
        'terminalLeaseState',true,
        'logicalFailure',false,
        'recoveryVersion','lease-watchdog-v4'
      )
    );
    if exhausted.handoff_account_id is not null then
      insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
      values (
        exhausted.dispatch_id,
        exhausted.handoff_account_id,
        'HANDOFF_READY',
        exhausted.entry_sha,
        jsonb_build_object(
          'reason','LEASE_RECOVERY_ATTEMPTS_EXHAUSTED_REQUIRES_REDISPATCH',
          'attempts',exhausted.attempts,
          'terminal',true,
          'requiredAction','SUPERVISOR_ESCALATION',
          'recoveryVersion','lease-watchdog-v4'
        )
      );
    end if;
    return next exhausted;
  end loop;

  update public.flix_council_dispatches
     set status='EXPIRED', updated_at=now()
   where status in ('LEASED','ACKED')
     and lease_expires_at is not null
     and lease_expires_at < now()
     and attempts < 2;

  for picked in
    select d.*
      from public.flix_council_dispatches d
      join public.flix_council_accounts a on a.account_id=d.fallback_account_id
     where d.status='EXPIRED'
       and d.attempts < 2
       and a.active=true
     order by d.priority asc, d.updated_at asc
     for update of d skip locked
     limit greatest(1, least(25, p_limit))
  loop
    update public.flix_council_dispatches d
       set status='LEASED',
           recipient_account_id=d.fallback_account_id,
           lease_expires_at=now() + make_interval(secs => (
             select lease_seconds from public.flix_council_accounts where account_id=d.fallback_account_id
           )),
           attempts=d.attempts+1,
           last_error=null,
           updated_at=now()
     where d.dispatch_id=picked.dispatch_id
     returning d.* into picked;

    insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
    values (
      picked.dispatch_id,
      picked.recipient_account_id,
      'DISPATCHED',
      picked.entry_sha,
      jsonb_build_object(
        'attempt',picked.attempts,'fallback',true,'automatic',true,
        'priority',picked.priority,'recoveryVersion','lease-watchdog-v4'
      )
    );

    return next picked;
  end loop;
end;
$function$;

revoke all on function public.council_recover_expired_dispatches(integer) from public, anon, authenticated;
grant execute on function public.council_recover_expired_dispatches(integer) to service_role;

create or replace function public.flixo_automation_watchdog_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_recovered integer := 0;
  v_remaining_expired_open_leases integer := 0;
  v_stale_resident_accounts integer := 0;
  v_state text;
  v_previous_state text;
  v_error text := null;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('FLIXO_AUTOMATION_WATCHDOG_V1', 0)) then
    return jsonb_build_object('ok', true, 'status', 'ALREADY_RUNNING', 'at', v_now);
  end if;

  select state into v_previous_state
  from public.flixo_automation_watchdog where id=1 for update;

  begin
    select count(*)::integer into v_recovered
      from public.council_recover_expired_dispatches(25);

    select count(*)::integer into v_remaining_expired_open_leases
      from public.flix_council_dispatches
     where status in ('LEASED','ACKED')
       and lease_expires_at is not null
       and lease_expires_at < v_now;

    select count(*)::integer into v_stale_resident_accounts
      from public.flix_council_accounts a
     where a.active=true
       and coalesce((a.metadata->>'residencyRequired')::boolean,false)=true
       and (
         a.last_seen_at is null
         or a.last_seen_at < v_now - make_interval(secs => greatest(120,a.lease_seconds*2))
       );

    v_state:=case
      when v_remaining_expired_open_leases>0 or v_stale_resident_accounts>0 then 'DEGRADED'
      when v_recovered>0 then 'RECOVERING'
      else 'HEALTHY'
    end;

    update public.flixo_automation_watchdog
       set state=v_state,
           last_tick_at=v_now,
           last_recovery_at=case when v_recovered>0 then v_now else last_recovery_at end,
           last_recovery_count=v_recovered,
           consecutive_failures=0,
           last_error=null,
           evidence=jsonb_build_object(
             'protocol','FLIXO-AUTOMATION-WATCHDOG-v1',
             'repository',repository,
             'branch',branch,
             'leaseRecoveryAuthority','public.council_recover_expired_dispatches',
             'recoveredCount',v_recovered,
             'remainingExpiredOpenLeases',v_remaining_expired_open_leases,
             'staleResidentAccounts',v_stale_resident_accounts,
             'healthRule','HEALTHY_ONLY_WHEN_NO_ACTIONABLE_EXPIRED_LEASES_OR_STALE_REQUIRED_RESIDENTS',
             'checkedAt',v_now
           ),
           updated_at=v_now
     where id=1;

    insert into public.flixo_automation_watchdog_events(watchdog_id,event_type,state,recovered_count,metadata)
    values(
      1,
      case when v_recovered>0 then 'LEASE_RECOVERY' else 'TICK' end,
      v_state,
      v_recovered,
      jsonb_build_object(
        'at',v_now,'previousState',v_previous_state,
        'remainingExpiredOpenLeases',v_remaining_expired_open_leases,
        'staleResidentAccounts',v_stale_resident_accounts,
        'recoveryMode','DETERMINISTIC_SINGLE_PASS'
      )
    );

    if v_previous_state is distinct from v_state then
      insert into public.flixo_automation_watchdog_events(watchdog_id,event_type,state,recovered_count,metadata)
      values(
        1,'STATE_CHANGE',v_state,v_recovered,
        jsonb_build_object(
          'from',v_previous_state,'to',v_state,'at',v_now,
          'remainingExpiredOpenLeases',v_remaining_expired_open_leases,
          'staleResidentAccounts',v_stale_resident_accounts
        )
      );
    end if;

    return jsonb_build_object(
      'ok',true,'status',v_state,'recoveredCount',v_recovered,
      'remainingExpiredOpenLeases',v_remaining_expired_open_leases,
      'staleResidentAccounts',v_stale_resident_accounts,'at',v_now
    );
  exception when others then
    v_error:=sqlerrm;
    update public.flixo_automation_watchdog
       set state='DEGRADED',
           last_tick_at=v_now,
           consecutive_failures=consecutive_failures+1,
           last_error=left(v_error,2000),
           evidence=jsonb_build_object(
             'protocol','FLIXO-AUTOMATION-WATCHDOG-v1',
             'failure',v_error,'at',v_now,'recoveryAuthority','COUNCIL_RECOVERY_RPC'
           ),
           updated_at=v_now
     where id=1;
    insert into public.flixo_automation_watchdog_events(watchdog_id,event_type,state,recovered_count,metadata)
    values(1,'FAILURE','DEGRADED',0,jsonb_build_object('at',v_now,'error',left(v_error,2000)));
    return jsonb_build_object('ok',false,'status','DEGRADED','error',v_error,'at',v_now);
  end;
end;
$function$;

revoke all on function public.flixo_automation_watchdog_tick() from public, anon, authenticated;
grant execute on function public.flixo_automation_watchdog_tick() to service_role;

revoke all on function public.flixo_auto_wake_stale_master3() from public, anon, authenticated;
grant execute on function public.flixo_auto_wake_stale_master3() to service_role;

revoke all on function public.flixo_retry_pending_assistant_wakes() from public, anon, authenticated;
grant execute on function public.flixo_retry_pending_assistant_wakes() to service_role;
