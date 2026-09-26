create or replace function public.flixo_append_agent_task_event(
  p_event_id uuid,
  p_task_id text,
  p_event_type text,
  p_source text,
  p_idempotency_key text,
  p_payload jsonb,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  previous_event record;
  inserted_event public.flixo_agent_task_events%rowtype;
  event_hash text;
begin
  if p_task_id is null or char_length(trim(p_task_id)) = 0 then
    raise exception 'TASK_ID_REQUIRED';
  end if;

  perform 1 from public.flixo_agent_tasks where task_id = p_task_id for update;

  select event_id, sequence, hash
    into previous_event
  from public.flixo_agent_task_events
  where task_id = p_task_id
  order by sequence desc
  limit 1;

  if exists (
    select 1 from public.flixo_agent_task_events
    where task_id = p_task_id and idempotency_key = p_idempotency_key
  ) then
    return null;
  end if;

  event_hash := encode(
    digest(
      convert_to(
        jsonb_build_object(
          'event_id', p_event_id,
          'task_id', p_task_id,
          'sequence', coalesce(previous_event.sequence, 0) + 1,
          'event_type', p_event_type,
          'source', p_source,
          'idempotency_key', p_idempotency_key,
          'payload', p_payload,
          'previous_hash', previous_event.hash,
          'occurred_at', p_occurred_at
        )::text,
        'utf8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.flixo_agent_task_events(
    event_id, task_id, sequence, event_type, source, idempotency_key,
    payload, previous_hash, hash, occurred_at
  )
  values (
    p_event_id, p_task_id, coalesce(previous_event.sequence, 0) + 1,
    p_event_type, p_source, p_idempotency_key,
    coalesce(p_payload, '{}'::jsonb), previous_event.hash, event_hash, p_occurred_at
  )
  returning * into inserted_event;

  return to_jsonb(inserted_event);
end;
$$;

revoke all on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) from public;
revoke all on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) from anon;
revoke all on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) from authenticated;
grant execute on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) to service_role;
