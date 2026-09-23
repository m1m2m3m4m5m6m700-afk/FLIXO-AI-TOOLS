create table if not exists public.flix_council_assistant_channel_tokens (
  wake_id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose = any (array['WAKE'::text,'STATUS'::text])),
  recipient_master text not null check (recipient_master = any (array['MASTER-1'::text,'MASTER-2'::text,'MASTER-3'::text])),
  message_id text not null unique,
  idempotency_key text not null unique,
  task_id text not null,
  work_package_id text not null,
  entry_sha text not null check (entry_sha ~ '^[0-9a-f]{40}$'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'::text),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists flixo_council_assistant_channel_tokens_lookup_idx
  on public.flixo_council_assistant_channel_tokens (token_hash, purpose, consumed_at, expires_at);

alter table public.flixo_council_assistant_channel_tokens enable row level security;
