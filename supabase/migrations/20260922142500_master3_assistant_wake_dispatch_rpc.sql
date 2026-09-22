create or replace function public.council_dispatch_assistant_wake(
  p_wake_id uuid,
  p_exact_sha text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wake_row public.flix_council_assistant_channel_tokens%rowtype;
  primary_account text;
  fallback_account text;
  dispatch_row public.flix_council_dispatches%rowtype;
begin
  if p_exact_sha is null or p_exact_sha !~ '^[0-9a-f]{40}$' then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_EXACT_SHA_INVALID');
  end if;

  select * into wake_row
  from public.flixo_council_assistant_channel_tokens
  where wake_id = p_wake_id
    and purpose = 'WAKE'
    and entry_sha = p_exact_sha
    and consumed_at is not null
  limit 1;

  if not found then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_ASSISTANT_WAKE_NOT_CLAIMED');
  end if;

  if wake_row.recipient_master = 'MASTER-3' then
    primary_account := 'WORKER_B';
    fallback_account := 'WORKER_A';
  elsif wake_row.recipient_master = 'MASTER-2' then
    primary_account := 'WORKER_A';
    fallback_account := 'WORKER_B';
  elsif wake_row.recipient_master = 'MASTER-1' then
    primary_account := 'CHIEF';
    fallback_account := 'CHIEF';
  else
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_ASSISTANT_RECIPIENT_INVALID');
  end if;

  insert into public.flix_council_dispatches (
    message_id,idempotency_key,task_id,work_package_id,entry_sha,
    primary_account_id,fallback_account_id,recipient_account_id,handoff_account_id,
    status,payload,evidence,session_id,lease_expires_at,attempts,priority
  )
  values (
    wake_row.message_id,wake_row.idempotency_key,wake_row.task_id,wake_row.work_package_id,wake_row.entry_sha,
    primary_account,fallback_account,primary_account,'CHIEF',
    'LEASED',
    jsonb_build_object(
      'directAssistantWake',true,
      'automaticDelivery',true,
      'recipientMaster',wake_row.recipient_master,
      'exactSha',p_exact_sha,
      'deliveryMode','DIRECT_MASTER_WAKE',
      'taskId',wake_row.task_id,
      'workPackageId',wake_row.work_package_id,
      'payload',wake_row.payload
    ),
    '{}'::jsonb,null,now()+interval '120 seconds',1,0
  )
  on conflict (message_id) do update set updated_at = now()
  returning * into dispatch_row;

  insert into public.flix_council_events (
    dispatch_id,account_id,event_type,exact_sha,payload
  )
  values (
    dispatch_row.dispatch_id,primary_account,'DISPATCHED',p_exact_sha,
    jsonb_build_object(
      'source','MASTER3_DIRECT_ASSISTANT',
      'recipientMaster',wake_row.recipient_master,
      'deliveryMode','DIRECT_MASTER_WAKE',
      'wakeId',wake_row.wake_id
    )
  );

  return jsonb_build_object(
    'accepted',true,
    'dispatch',jsonb_build_object(
      'dispatchId',dispatch_row.dispatch_id,
      'messageId',dispatch_row.message_id,
      'idempotencyKey',dispatch_row.idempotency_key,
      'taskId',dispatch_row.task_id,
      'workPackageId',dispatch_row.work_package_id,
      'entrySha',dispatch_row.entry_sha,
      'status',dispatch_row.status,
      'primaryAccountId',dispatch_row.primary_account_id,
      'fallbackAccountId',dispatch_row.fallback_account_id,
      'leaseExpiresAt',dispatch_row.lease_expires_at,
      'attempts',dispatch_row.attempts
    )
  );
end;
$$;

revoke all on function public.council_dispatch_assistant_wake(uuid,text) from public, anon, authenticated;
grant execute on function public.council_dispatch_assistant_wake(uuid,text) to service_role;
