-- FLIXO external GPT council runtime schema.
-- The same schema is applied to Supabase project zrpsmgdrtwzrhkjwwujo.
-- RLS is enabled and only server-side service-role access is permitted.

create table if not exists public.flix_council_accounts (
  account_id text primary key check (account_id in ('CHIEF','WORKER_A','WORKER_B')),
  role text not null check (role in ('CHIEF','WORKER_A','WORKER_B')),
  transport text not null check (transport in ('PUSH','POLL','HYBRID')),
  endpoint_env text,
  token_env text not null,
  active boolean not null default true,
  lease_seconds integer not null default 120 check (lease_seconds between 15 and 3600),
  current_session_id text,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flix_council_dispatches (
  dispatch_id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  idempotency_key text not null unique,
  task_id text not null,
  work_package_id text not null,
  entry_sha text not null check (entry_sha ~ '^[0-9a-f]{40}$'),
  primary_account_id text not null references public.flix_council_accounts(account_id),
  fallback_account_id text not null references public.flix_council_accounts(account_id),
  recipient_account_id text not null references public.flix_council_accounts(account_id),
  handoff_account_id text not null default 'CHIEF' references public.flix_council_accounts(account_id),
  status text not null check (status in ('LEASED','ACKED','DONE','FAILED','CANCELLED','EXPIRED')),
  payload jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  session_id text,
  lease_expires_at timestamptz,
  acked_at timestamptz,
  completed_at timestamptz,
  attempts integer not null default 1 check (attempts >= 0 and attempts <= 20),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flix_council_events (
  event_id uuid primary key default gen_random_uuid(),
  dispatch_id uuid references public.flix_council_dispatches(dispatch_id) on delete cascade,
  account_id text references public.flix_council_accounts(account_id),
  event_type text not null check (event_type in ('DISPATCHED','ACKED','HEARTBEAT','COMPLETED','FAILED','EXPIRED','HANDOFF_READY','WAKE_PUSH_FAILED')),
  exact_sha text not null check (exact_sha ~ '^[0-9a-f]{40}$'),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.flix_council_accounts enable row level security;
alter table public.flix_council_dispatches enable row level security;
alter table public.flix_council_events enable row level security;

revoke all on public.flix_council_accounts from anon, authenticated;
revoke all on public.flix_council_dispatches from anon, authenticated;
revoke all on public.flix_council_events from anon, authenticated;

-- Apply the accompanying RPC functions from:
-- council_external_accounts_dispatch_leases_v1
-- council_external_lease_recovery_v1
