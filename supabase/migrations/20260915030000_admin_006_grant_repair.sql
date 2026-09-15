-- ADMIN-006 grant repair: make the evidence substrate reachable by the secret/service_role key.
-- Idempotent and non-production-safe: this only repairs Data API table grants.
-- RLS remains enabled; service_role bypasses RLS by design.

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.flix_admin_evidence to service_role;
grant select, insert, update, delete on table public.flix_admin_audit_events to service_role;

-- Keep public client roles denied explicitly.
revoke all on table public.flix_admin_evidence from anon, authenticated;
revoke all on table public.flix_admin_audit_events from anon, authenticated;
