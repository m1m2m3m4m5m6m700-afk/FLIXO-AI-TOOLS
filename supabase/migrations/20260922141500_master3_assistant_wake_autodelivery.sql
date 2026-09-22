alter table public.flixo_council_assistant_channel_tokens
  add column if not exists delivery_request_id bigint;

create or replace function public.flixo_council_assistant_wake_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id bigint;
begin
  if new.purpose = 'WAKE' and new.consumed_at is null and new.expires_at > now() then
    select net.http_get(
      'https://zrpsmgdrtwzrhkjwwujo.supabase.co/functions/v1/flixo-council-runtime',
      params := jsonb_build_object(
        'action', 'assistant-channel',
        'purpose', 'WAKE',
        'tokenHash', new.token_hash,
        'entrySha', new.entry_sha
      ),
      timeout_milliseconds := 5000
    ) into request_id;

    update public.flixo_council_assistant_channel_tokens
      set delivery_request_id = request_id
      where wake_id = new.wake_id;
  end if;

  return new;
end;
$$;

drop trigger if exists flixo_council_assistant_wake_notify_trigger
  on public.flixo_council_assistant_channel_tokens;

create trigger flixo_council_assistant_wake_notify_trigger
after insert on public.flixo_council_assistant_channel_tokens
for each row
execute function public.flixo_council_assistant_wake_notify();

do $cron$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'flixo-master3-assistant-wake-retry'
  ) then
    perform cron.schedule(
      'flixo-master3-assistant-wake-retry',
      '* * * * *',
      $job$
        select net.http_get(
          'https://zrpsmgdrtwzrhkjwwujo.supabase.co/functions/v1/flixo-council-runtime',
          params := jsonb_build_object(
            'action', 'assistant-channel',
            'purpose', 'WAKE',
            'tokenHash', token_hash,
            'entrySha', entry_sha
          ),
          timeout_milliseconds := 5000
        )
        from public.flix_council_assistant_channel_tokens
        where purpose = 'WAKE'
          and consumed_at is null
          and expires_at > now()
        order by created_at asc
        limit 20;
      $job$
    );
  end if;
end
$cron$;