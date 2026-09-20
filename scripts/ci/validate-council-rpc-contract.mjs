#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='db/council-external-accounts.sql';
const sql=fs.readFileSync(file,'utf8');

for (const marker of [
  'create table if not exists public.flix_council_accounts',
  'create table if not exists public.flix_council_dispatches',
  'create table if not exists public.flix_council_events',
  'create or replace function public.council_claim_dispatch',
  'create or replace function public.council_ack_dispatch',
  'create or replace function public.council_heartbeat_dispatch',
  'create or replace function public.council_complete_dispatch',
  'create or replace function public.council_recover_expired_dispatches',
  'security definer',
  'set search_path = public, pg_catalog',
  'for update',
  'skip locked',
  'COUNCIL_EXACT_SHA_MISMATCH',
  'COUNCIL_SESSION_MISMATCH',
  'COUNCIL_ACCOUNT_MISMATCH',
  'COUNCIL_LEASE_EXPIRED',
  'revoke all on function public.council_claim_dispatch(text) from public, anon, authenticated',
  'revoke all on function public.council_ack_dispatch(uuid, text, text, text) from public, anon, authenticated',
  'revoke all on function public.council_heartbeat_dispatch(uuid, text, text, text) from public, anon, authenticated',
  'revoke all on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) from public, anon, authenticated',
  'revoke all on function public.council_recover_expired_dispatches(integer) from public, anon, authenticated',
  'grant execute on function public.council_claim_dispatch(text) to service_role',
  'grant execute on function public.council_ack_dispatch(uuid, text, text, text) to service_role',
  'grant execute on function public.council_heartbeat_dispatch(uuid, text, text, text) to service_role',
  'grant execute on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) to service_role',
  'grant execute on function public.council_recover_expired_dispatches(integer) to service_role',
]) assert.ok(sql.includes(marker), `Missing RPC contract marker: ${marker}`);

assert.match(sql,/security definer[\\s\\S]*?set search_path = public, pg_catalog/iu);

console.log('COUNCIL_RPC_CONTRACT=PASS');
