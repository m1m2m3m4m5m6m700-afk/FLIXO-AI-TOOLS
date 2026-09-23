create or replace function public.council_claim_assistant_wake(
  p_token_hash text,
  p_purpose text,
  p_exact_sha text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wake_row public.flixo_council_assistant_channel_tokens%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_ASSISTANT_TOKEN_HASH_INVALID');
  end if;
  if p_purpose not in ('WAKE','STATUS') then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_ASSISTANT_PURPOSE_INVALID');
  end if;
  if p_exact_sha is null or p_exact_sha !~ '^[0-9a-f]{40}$' then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_EXACT_SHA_INVALID');
  end if;

  select * into wake_row
  from public.flixo_council_assistant_channel_tokens
  where token_hash = p_token_hash
    and purpose = p_purpose
    and consumed_at is null
    and expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_ASSISTANT_NONCE_REJECTED');
  end if;

  if wake_row.entry_sha <> p_exact_sha then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_ASSISTANT_EXACT_SHA_MISMATCH');
  end if;

  update public.flixo_council_assistant_channel_tokens
  set consumed_at = now()
  where wake_id = wake_row.wake_id
    and consumed_at is null;

  if not found then
    return jsonb_build_object('accepted', false, 'reason', 'COUNCIL_ASSISTANT_NONCE_ALREADY_CONSUMED');
  end if;

  return jsonb_build_object(
    'accepted', true,
    'wake', jsonb_build_object(
      'wakeId', wake_row.wake_id,
      'recipientMaster', wake_row.recipient_master,
      'messageId', wake_row.message_id,
      'idempotencyKey', wake_row.idempotency_key,
      'taskId', wake_row.task_id,
      'workPackageId', wake_row.work_package_id,
      'entrySha', wake_row.entry_sha,
      'purpose', wake_row.purpose,
      'payload', wake_row.payload
    )
  );
end;
$$;

revoke all on function public.council_claim_assistant_wake(text,text,text) from public, anon, authenticated;
grant execute on function public.council_claim_assistant_wake(text,text,text) to service_role;
