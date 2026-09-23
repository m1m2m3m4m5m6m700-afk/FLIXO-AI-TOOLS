-- Central Chair-1 custody. Runtime state is shared across all runners.
create table if not exists public.flix_chair1_leases (
  chair_id text primary key check (chair_id = 'chair_1'),
  owner_agent_id text not null default 'assistantController' check (owner_agent_id = 'assistantController'),
  status text not null default 'OWNER_CUSTODY' check (status in ('OWNER_CUSTODY','DELEGATED')),
  holder_agent_id text,
  task_id text,
  work_package_id text,
  exact_sha text,
  session_id text,
  lease_id text,
  fencing_token_hash text,
  delegated_by text,
  delegated_at timestamptz,
  heartbeat_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flix_chair1_exact_sha_ck check (exact_sha is null or exact_sha ~ '^[0-9a-f]{40}$'),
  constraint flix_chair1_lease_id_ck check (lease_id is null or lease_id ~ '^[0-9a-f-]{36}$'),
  constraint flix_chair1_fencing_hash_ck check (fencing_token_hash is null or fencing_token_hash ~ '^[0-9a-f]{64}$')
);

insert into public.flix_chair1_leases(chair_id, owner_agent_id, status)
values ('chair_1','assistantController','OWNER_CUSTODY')
on conflict (chair_id) do nothing;

alter table public.flix_chair1_leases enable row level security;
drop policy if exists flix_chair1_service_only on public.flix_chair1_leases;
create policy flix_chair1_service_only
on public.flix_chair1_leases for all to service_role
using (true) with check (true);
revoke all on public.flix_chair1_leases from anon, authenticated;
grant all on public.flix_chair1_leases to service_role;

create or replace function public.flix_chair1_delegate(
  p_actor text, p_holder_agent_id text, p_task_id text, p_work_package_id text,
  p_exact_sha text, p_session_id text, p_lease_id text, p_fencing_token_hash text,
  p_lease_seconds integer default 2700
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.flix_chair1_leases;
begin
  if p_actor <> 'assistantController' then raise exception 'CHAIR1_CONTROLLER_ONLY'; end if;
  if nullif(btrim(p_holder_agent_id),'') is null then raise exception 'CHAIR1_HOLDER_REQUIRED'; end if;
  if nullif(btrim(p_task_id),'') is null then raise exception 'CHAIR1_TASK_REQUIRED'; end if;
  if nullif(btrim(p_work_package_id),'') is null then raise exception 'CHAIR1_WORK_PACKAGE_REQUIRED'; end if;
  if p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'CHAIR1_SHA_INVALID'; end if;
  if p_lease_id !~ '^[0-9a-f-]{36}$' then raise exception 'CHAIR1_LEASE_ID_INVALID'; end if;
  if p_fencing_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'CHAIR1_FENCING_HASH_INVALID'; end if;
  if p_lease_seconds < 60 or p_lease_seconds > 10800 then raise exception 'CHAIR1_LEASE_SECONDS_INVALID'; end if;
  select * into r from public.flix_chair1_leases where chair_id='chair_1' for update;
  if r.status='DELEGATED' then raise exception 'CHAIR1_ACTIVE_DELEGATION'; end if;
  update public.flix_chair1_leases
  set status='DELEGATED', holder_agent_id=p_holder_agent_id, task_id=p_task_id,
      work_package_id=p_work_package_id, exact_sha=p_exact_sha, session_id=p_session_id,
      lease_id=p_lease_id, fencing_token_hash=p_fencing_token_hash,
      delegated_by='assistantController', delegated_at=now(), heartbeat_at=now(),
      expires_at=now()+make_interval(secs=>p_lease_seconds), updated_at=now()
  where chair_id='chair_1'
  returning * into r;
  return to_jsonb(r);
end; $$;

create or replace function public.flix_chair1_heartbeat(
  p_holder_agent_id text, p_task_id text, p_work_package_id text, p_exact_sha text,
  p_lease_id text, p_fencing_token_hash text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.flix_chair1_leases;
begin
  select * into r from public.flix_chair1_leases where chair_id='chair_1' for update;
  if r.status<>'DELEGATED' then raise exception 'CHAIR1_NOT_DELEGATED'; end if;
  if r.holder_agent_id<>p_holder_agent_id or r.task_id<>p_task_id or r.work_package_id<>p_work_package_id then raise exception 'CHAIR1_IDENTITY_MISMATCH'; end if;
  if r.exact_sha<>p_exact_sha or r.lease_id<>p_lease_id or r.fencing_token_hash<>p_fencing_token_hash then raise exception 'CHAIR1_PROOF_MISMATCH'; end if;
  if r.expires_at<=now() then raise exception 'CHAIR1_LEASE_EXPIRED'; end if;
  update public.flix_chair1_leases
  set heartbeat_at=now(), expires_at=greatest(expires_at, now()+interval '90 seconds'), updated_at=now()
  where chair_id='chair_1' returning * into r;
  return to_jsonb(r);
end; $$;

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
  if r.holder_agent_id<>p_holder_agent_id then raise exception 'CHAIR1_HOLDER_MISMATCH'; end if;
  if r.task_id<>p_task_id or r.work_package_id<>p_work_package_id then raise exception 'CHAIR1_SCOPE_MISMATCH'; end if;
  if r.exact_sha<>p_exact_sha then raise exception 'CHAIR1_SHA_MISMATCH'; end if;
  if r.lease_id<>p_lease_id or r.fencing_token_hash<>p_fencing_token_hash then raise exception 'CHAIR1_FENCE_MISMATCH'; end if;
  if r.expires_at<=now() then raise exception 'CHAIR1_LEASE_EXPIRED'; end if;
  if r.heartbeat_at is null or r.heartbeat_at<now()-interval '90 seconds' then raise exception 'CHAIR1_HEARTBEAT_STALE'; end if;
  return jsonb_build_object('authorized',true,'chairId','chair_1','ownerAgentId',r.owner_agent_id,
    'holderAgentId',r.holder_agent_id,'taskId',r.task_id,'workPackageId',r.work_package_id,
    'exactSha',r.exact_sha,'leaseId',r.lease_id,'heartbeatAt',r.heartbeat_at,'expiresAt',r.expires_at);
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
  if r.status<>'DELEGATED' then raise exception 'CHAIR1_NOT_DELEGATED'; end if;
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

revoke all on function public.flix_chair1_delegate(text,text,text,text,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.flix_chair1_heartbeat(text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.flix_chair1_verify(text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.flix_chair1_release(text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.flix_chair1_delegate(text,text,text,text,text,text,text,text,integer) to service_role;
grant execute on function public.flix_chair1_heartbeat(text,text,text,text,text,text) to service_role;
grant execute on function public.flix_chair1_verify(text,text,text,text,text,text) to service_role;
grant execute on function public.flix_chair1_release(text,text,text,text,text,text,boolean) to service_role;
