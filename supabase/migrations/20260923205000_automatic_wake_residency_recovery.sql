-- Automatic wake and lease-residency recovery.
-- GitHub schedules remain as secondary transport; pg_cron is the minute-level
-- database recovery floor so queued work is retried without relying on hosted
-- workflow cadence.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.flixo_retry_pending_assistant_wakes()
returns integer
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  picked record;
  request_id bigint;
  sent integer := 0;
begin
  for picked in
    select wake_id, token_hash, entry_sha
      from public.flixo_council_assistant_channel_tokens
     where purpose = 'WAKE'
       and consumed_at is null
       and expires_at > now()
     order by created_at asc
     limit 20
  loop
    select net.http_get(
      'https://zrpsmgdrtwzrhkjwwujo.supabase.co/functions/v1/flixo-council-runtime',
      params := jsonb_build_object(
        'action', 'assistant-channel',
        'purpose', 'WAKE',
        'tokenHash', picked.token_hash,
        'entrySha', picked.entry_sha
      ),
      timeout_milliseconds := 60000
    ) into request_id;

    update public.flixo_council_assistant_channel_tokens
       set delivery_request_id = coalesce(request_id, delivery_request_id)
     where wake_id = picked.wake_id;

    sent := sent + 1;
  end loop;
  return sent;
end;
$function$;

do $block$
declare
  jid bigint;
begin
  select jobid into jid
  from cron.job
  where jobname = 'flixo-assistant-wake-retry';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
  perform cron.schedule(
    'flixo-assistant-wake-retry',
    '* * * * *',
    $job$select public.flixo_retry_pending_assistant_wakes();$job$
  );
end;
$block$;

do $block$
declare
  jid bigint;
begin
  select jobid into jid
  from cron.job
  where jobname = 'flixo-council-lease-recovery';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
  perform cron.schedule(
    'flixo-council-lease-recovery',
    '* * * * *',
    $job$select count(*) from public.council_recover_expired_dispatches(25);$job$
  );
end;
$block$;
