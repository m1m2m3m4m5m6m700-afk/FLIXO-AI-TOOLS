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
set search_path = public, extensions, pg_catalog
as $$
declare
  previous_event record;
  inserted_event public.flixo_agent_task_events%rowtype;
  event_hash text;
  db_event_type text;
  db_source text;
  stored_payload jsonb;
begin
  if p_task_id is null or char_length(trim(p_task_id)) = 0 then
    raise exception 'TASK_ID_REQUIRED';
  end if;

  db_event_type := case
    when p_event_type = 'chat.message' then 'USER_MESSAGE'
    when p_event_type in ('agent.plan','agent.decision') then 'AGENT_DECISION'
    when p_event_type = 'approval.requested' then 'APPROVAL_REQUESTED'
    when p_event_type = 'approval.granted' then 'APPROVAL_GRANTED'
    when p_event_type = 'approval.denied' then 'APPROVAL_DENIED'
    when p_event_type = 'workflow.started' then 'WORKFLOW_STARTED'
    when p_event_type = 'workflow.step' then 'WORKFLOW_STEP'
    when p_event_type = 'execution.started' then 'EXECUTION_STARTED'
    when p_event_type = 'execution.finished' then 'EXECUTION_FINISHED'
    when p_event_type = 'execution.failed' then 'EXECUTION_FAILED'
    when p_event_type = 'task.cancelled' then 'TASK_CANCELLED'
    else 'SYSTEM'
  end;

  db_source := case p_source
    when 'USER_MESSAGE' then 'CHAT'
    when 'FILE_UPLOAD' then 'UPLOAD'
    when 'SCHEDULE' then 'SCHEDULE'
    when 'WEBHOOK' then 'WEBHOOK'
    when 'TOOL_RESULT' then 'TOOL'
    else 'SYSTEM'
  end;

  stored_payload := jsonb_build_object('_eventType', p_event_type, '_source', p_source) || coalesce(p_payload, '{}'::jsonb);

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
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'event_id', p_event_id,
          'task_id', p_task_id,
          'sequence', coalesce(previous_event.sequence, 0) + 1,
          'event_type', db_event_type,
          'source', db_source,
          'idempotency_key', p_idempotency_key,
          'payload', stored_payload,
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
    db_event_type, db_source, p_idempotency_key,
    stored_payload, previous_event.hash, event_hash, p_occurred_at
  )
  returning * into inserted_event;

  return to_jsonb(inserted_event);
end;
$$;

revoke all on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) from public;
revoke all on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) from anon;
revoke all on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) from authenticated;
grant execute on function public.flixo_append_agent_task_event(uuid, text, text, text, text, jsonb, timestamptz) to service_role;
