-- Auto-rewake a stale MASTER-3 runtime only while a real Council task is leased.
-- This is a recovery floor, not a task generator: no active lease => no wake.
create or replace function public.flixo_auto_wake_stale_master3()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  active_task record;
  wake_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('flixo-auto-wake-master3'));

  select
    d.dispatch_id,
    d.message_id,
    d.idempotency_key,
    d.task_id,
    d.work_package_id,
    d.entry_sha,
    d.priority
  into active_task
  from public.flix_council_dispatches d
  join public.flix_council_accounts a
    on a.account_id = d.recipient_account_id
  where d.recipient_account_id = 'WORKER_B'
    and d.status in ('LEASED','ACKED')
    and d.updated_at > now() - interval '15 minutes'
    and (
      a.last_seen_at is null
      or a.last_seen_at < now() - interval '2 minutes'
    )
  order by d.priority asc, d.updated_at desc
  limit 1;

  if not found then
    return 0;
  end if;

  if exists (
    select 1
    from public.flixo_council_assistant_channel_tokens t
    where t.recipient_master = 'MASTER-3'
      and t.purpose = 'WAKE'
      and t.created_at > now() - interval '5 minutes'
  ) then
    return 0;
  end if;

  insert into public.flixo_council_assistant_channel_tokens (
    token_hash,
    purpose,
    recipient_master,
    message_id,
    idempotency_key,
    task_id,
    work_package_id,
    entry_sha,
    payload,
    expires_at
  )
  values (
    encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    'WAKE',
    'MASTER-3',
    'AUTO-WAKE:MASTER-3:' || active_task.dispatch_id::text || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'AUTO-WAKE:MASTER-3:' || active_task.dispatch_id::text || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    active_task.task_id,
    active_task.work_package_id,
    active_task.entry_sha,
    jsonb_build_object(
      'automaticWake', true,
      'recovery', 'STALE_RUNTIME_RESIDENCY',
      'sourceDispatchId', active_task.dispatch_id,
      'sourceMessageId', active_task.message_id,
      'exactSha', active_task.entry_sha,
      'instruction', 'Wake the stale MASTER-3 runtime and continue the currently leased task. Do not declare GREEN or certification.'
    ),
    now() + interval '10 minutes'
  )
  returning wake_id into wake_id;

  return 1;
end;
$function$;

do $block$
declare
  jid bigint;
begin
  select jobid into jid
  from cron.job
  where jobname = 'flixo-master3-stale-auto-wake';

  if jid is not null then
    perform cron.unschedule(jid);
  end if;

  perform cron.schedule(
    'flixo-master3-stale-auto-wake',
    '* * * * *',
    $job$select public.flixo_auto_wake_stale_master3();$job$
  );
end;
$block$;
