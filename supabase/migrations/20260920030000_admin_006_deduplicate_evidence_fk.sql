-- ADMIN-006 cleanup: remove the duplicate FK introduced during live-schema compatibility hardening.
alter table public.flix_admin_audit_events
  drop constraint if exists flix_admin_audit_events_evidence_fk;
