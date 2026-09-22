-- Harden Central Chair-1 proof semantics so every verification exposes and enforces
-- the immutable controller delegation identity used by local and CI mutation gates.

alter table if exists public.flix_chair1_leases
  drop constraint if exists flix_chair1_delegated_by_ck;

alter table if exists public.flix_chair1_leases
  add constraint flix_chair1_delegated_by_ck
  check (delegated_by is null or delegated_by = 'assistantController');

create or replace function public.flix_chair1_verify(
  p_holder_agent_id text, p_task_id text, p_work_package_id text, p_exact_sha text,
  p_lease_id text, p_fencing_token_hash text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.flix_chair1_leases;
begin
  select * into r from public.flix_chair1_leases where chair_id='chair_1' for update;
  if r.owner_agent_id<>'assistantController' then raise exception 'CHAIR1_OWNER_INVALID'; end if;
  if r.status<>'DELEGATED' then raise exception 'CHAIR1_NOT_DELEGATED'; end if;
  if r.delegated_by<>'assistantController' then raise exception 'CHAIR1_DELEGATOR_INVALID'; end if;
  if r.holder_agent_id<>p_holder_agent_id then raise exception 'CHAIR1_HOLDER_MISMATCH'; end if;
  if r.task_id<>p_task_id or r.work_package_id<>p_work_package_id then raise exception 'CHAIR1_SCOPE_MISMATCH'; end if;
  if r.exact_sha<>p_exact_sha then raise exception 'CHAIR1_SHA_MISMATCH'; end if;
  if r.lease_id<>p_lease_id or r.fencing_token_hash<>p_fencing_token_hash then raise exception 'CHAIR1_FENCE_MISMATCH'; end if;
  if r.expires_at<=now() then raise exception 'CHAIR1_LEASE_EXPIRED'; end if;
  if r.heartbeat_at is null or r.heartbeat_at<now()-interval '90 seconds' then raise exception 'CHAIR1_HEARTBEAT_STALE'; end if;
  return jsonb_build_object(
    'authorized',true,
    'chairId','chair_1',
    'ownerAgentId',r.owner_agent_id,
    'holderAgentId',r.holder_agent_id,
    'taskId',r.task_id,
    'workPackageId',r.work_package_id,
    'exactSha',r.exact_sha,
    'leaseId',r.lease_id,
    'fencingTokenHash',r.fencing_token_hash,
    'delegatedBy',r.delegated_by,
    'heartbeatAt',r.heartbeat_at,
    'expiresAt',r.expires_at
  );
end; $$;

create or replace function public.flix_chair1_release(
  p_holder_agent_id text, p_task_id text, p_work_package_id text, p_exact_sha text,
  p_lease_id text, p_fencing_token_hash text, p_successful boolean default false
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.flix_chair1_leases;
begin
  select * into r from public.flix_chair1_leases where chair_id='chair_1' for update;
  if r.owner_agent_id<>'assistantController' then raise exception 'CHAIR1_OWNER_INVALID'; end if;
  if r.status<>'DELEGATED' then raise exception 'CHAIR1_NOT_DELEGATED'; end if;
  if r.delegated_by<>'assistantController' then raise exception 'CHAIR1_DELEGATOR_INVALID'; end if;
  if r.holder_agent_id<>p_holder_agent_id or r.task_id<>p_task_id or r.work_package_id<>p_work_package_id then raise exception 'CHAIR1_IDENTITY_MISMATCH'; end if;
  if r.exact_sha<>p_exact_sha or r.lease_id<>p_lease_id or r.fencing_token_hash<>p_fencing_token_hash then raise exception 'CHAIR1_PROOF_MISMATCH'; end if;
  if not p_successful then raise exception 'CHAIR1_RELEASE_REQUIRES_TASK_CLOSE'; end if;
  update public.flix_chair1_leases
  set status='OWNER_CUSTODY', holder_agent_id=null, task_id=null, work_package_id=null,
      exact_sha=null, session_id=null, lease_id=null, fencing_token_hash=null,
      delegated_by=null, delegated_at=null, heartbeat_at=null, expires_at=null, updated_at=now()
  where chair_id='chair_1' returning * into r;
  return to_jsonb(r);
end; $$;
