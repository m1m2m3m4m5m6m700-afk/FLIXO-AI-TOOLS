create or replace function public.flixo_council_assistant_wake_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  request_id bigint;
begin
  if new.purpose = 'WAKE' and new.consumed_at is null and new.expires_at > now() then
    select net.http_post(
      'https://zrpsmgdrtwzrhkjwwujo.supabase.co/functions/v1/flixo-council-runtime',
      body := jsonb_build_object(
        'purpose', 'WAKE',
        'tokenHash', new.token_hash,
        'entrySha', new.entry_sha
      ),
      params := jsonb_build_object(
        'action', 'assistant-channel'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
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

create or replace function public.flixo_retry_pending_assistant_wakes()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  picked record;
  request_id bigint;
  sent integer := 0;
begin
  for picked in
    select wake_id, token_hash, entry_sha
      from public.flixo_council_assistant_channel_tokens
     where purpose='WAKE'
       and consumed_at is null
       and expires_at > now()
     order by created_at asc
     limit 20
  loop
    select net.http_post(
      'https://zrpsmgdrtwzrhkjwwujo.supabase.co/functions/v1/flixo-council-runtime',
      body := jsonb_build_object(
        'purpose','WAKE',
        'tokenHash',picked.token_hash,
        'entrySha',picked.entry_sha
      ),
      params := jsonb_build_object(
        'action','assistant-channel'
      ),
      headers := jsonb_build_object(
        'Content-Type','application/json'
      ),
      timeout_milliseconds := 5000
    ) into request_id;

    update public.flixo_council_assistant_channel_tokens
       set delivery_request_id = coalesce(request_id, delivery_request_id)
     where wake_id=picked.wake_id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.flixo_retry_pending_assistant_wakes() from public, anon, authenticated;
grant execute on function public.flixo_retry_pending_assistant_wakes() to service_role;
