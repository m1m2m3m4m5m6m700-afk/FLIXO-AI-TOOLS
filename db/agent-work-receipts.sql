-- FLIXO agent work receipt ledger.
-- Durable source of truth for agent work events. Local session ledgers are mirrors only.

create table if not exists public.flix_agent_work_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  session_id text not null,
  agent_id text not null,
  task_id text not null,
  work_package_id text,
  stage text not null check (stage in ('WORK_STARTED','WORK_RESULT','WORK_HEARTBEAT','HANDOFF','CLOSED','ABORTED')),
  exact_sha text not null check (exact_sha ~ '^[0-9a-f]{40}$'),
  chair_id text not null check (chair_id in ('chair_1','chair_2','chair_3')),
  chair_lease_id text not null check (chair_lease_id ~ '^[0-9a-f]{64}$'),
  sequence_no integer not null check (sequence_no >= 1),
  previous_receipt_hash text,
  receipt_hash text not null unique check (receipt_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}'::jsonb,
  result_digest text,
  created_at timestamptz not null default now(),
  unique(session_id, sequence_no)
);

create index if not exists flix_agent_work_receipts_session_idx
  on public.flix_agent_work_receipts(session_id, sequence_no);

create index if not exists flix_agent_work_receipts_task_idx
  on public.flix_agent_work_receipts(task_id, created_at);

alter table public.flix_agent_work_receipts enable row level security;
revoke all on public.flix_agent_work_receipts from anon, authenticated;
revoke all on public.flix_agent_work_receipts from public;

create or replace function public.record_agent_work_receipt(
  p_idempotency_key text,
  p_session_id text,
  p_agent_id text,
  p_task_id text,
  p_work_package_id text,
  p_stage text,
  p_exact_sha text,
  p_chair_id text,
  p_chair_lease_id text,
  p_payload jsonb default '{}'::jsonb,
  p_result_digest text default null
)
returns setof public.flix_agent_work_receipts
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_previous_hash text;
  v_sequence integer;
  v_receipt_hash text;
  v_existing public.flix_agent_work_receipts%rowtype;
  v_canonical text;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'AGENT_RECEIPT_IDEMPOTENCY_REQUIRED';
  end if;
  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'AGENT_RECEIPT_SESSION_REQUIRED';
  end if;
  if p_agent_id is null or btrim(p_agent_id) = '' then
    raise exception 'AGENT_RECEIPT_AGENT_REQUIRED';
  end if;
  if p_task_id is null or btrim(p_task_id) = '' then
    raise exception 'AGENT_RECEIPT_TASK_REQUIRED';
  end if;
  if p_stage not in ('WORK_STARTED','WORK_RESULT','WORK_HEARTBEAT','HANDOFF','CLOSED','ABORTED') then
    raise exception 'AGENT_RECEIPT_STAGE_INVALID';
  end if;
  if p_exact_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'AGENT_RECEIPT_SHA_INVALID';
  end if;
  if p_chair_id not in ('chair_1','chair_2','chair_3') then
    raise exception 'AGENT_RECEIPT_CHAIR_INVALID';
  end if;
  if p_chair_lease_id !~ '^[0-9a-f]{64}$' then
    raise exception 'AGENT_RECEIPT_LEASE_INVALID';
  end if;

  select * into v_existing
    from public.flix_agent_work_receipts
   where idempotency_key = p_idempotency_key;
  if found then
    return next v_existing;
    return;
  end if;

  -- Serialize receipt sequence allocation per session.
  perform pg_advisory_xact_lock(hashtextextended(p_session_id, 0));

  select coalesce(max(sequence_no), 0) + 1,
         (array_agg(receipt_hash order by sequence_no desc))[1]
    into v_sequence, v_previous_hash
    from public.flix_agent_work_receipts
   where session_id = p_session_id;

  if v_sequence > 1 and v_previous_hash is null then
    raise exception 'AGENT_RECEIPT_CHAIN_BROKEN';
  end if;

  v_canonical := jsonb_build_object(
    'idempotencyKey', p_idempotency_key,
    'sessionId', p_session_id,
    'agentId', p_agent_id,
    'taskId', p_task_id,
    'workPackageId', p_work_package_id,
    'stage', p_stage,
    'exactSha', p_exact_sha,
    'chairId', p_chair_id,
    'chairLeaseId', p_chair_lease_id,
    'sequenceNo', v_sequence,
    'previousReceiptHash', v_previous_hash,
    'payload', coalesce(p_payload, '{}'::jsonb),
    'resultDigest', p_result_digest
  )::text;

  v_receipt_hash := encode(digest(v_canonical, 'sha256'), 'hex');

  insert into public.flix_agent_work_receipts(
    idempotency_key, session_id, agent_id, task_id, work_package_id,
    stage, exact_sha, chair_id, chair_lease_id, sequence_no,
    previous_receipt_hash, receipt_hash, payload, result_digest
  ) values (
    p_idempotency_key, p_session_id, p_agent_id, p_task_id, p_work_package_id,
    p_stage, p_exact_sha, p_chair_id, p_chair_lease_id, v_sequence,
    v_previous_hash, v_receipt_hash, coalesce(p_payload, '{}'::jsonb), p_result_digest
  )
  returning * into v_existing;

  return next v_existing;
end;
$$;

revoke all on function public.record_agent_work_receipt(
  text,text,text,text,text,text,text,text,text,jsonb,text
) from public, anon, authenticated;

grant execute on function public.record_agent_work_receipt(
  text,text,text,text,text,text,text,text,text,jsonb,text
) to service_role;

-- No UPDATE/DELETE RPC is exposed. The ledger is append-only by contract.
