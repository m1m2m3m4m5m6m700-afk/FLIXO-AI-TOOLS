-- ADMIN-006 hardening: apply integrity constraints in a new migration.
-- Keep the original 20260914040000 migration immutable.
-- Production controlled execution remains disabled.

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_status_check
  check (status in ('VERIFIED','FAILED','BLOCKED','UNAVAILABLE','STALE','UNKNOWN'));

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_assertion_nonempty_check
  check (length(trim(assertion_id)) > 0);

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_exact_sha_check
  check (length(trim(exact_sha)) >= 40);

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_source_nonempty_check
  check (length(trim(source)) > 0);

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_evaluator_nonempty_check
  check (length(trim(evaluator)) > 0);

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_environment_nonempty_check
  check (length(trim(environment)) > 0);

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_integrity_sha_check
  check (length(integrity_sha256) = 64);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_actor_nonempty_check
  check (length(trim(actor_subject)) > 0);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_action_nonempty_check
  check (length(trim(action)) > 0);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_target_type_nonempty_check
  check (length(trim(target_type)) > 0);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_target_id_nonempty_check
  check (length(trim(target_id)) > 0);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_exact_sha_check
  check (length(trim(exact_sha)) >= 40);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_environment_nonempty_check
  check (length(trim(environment)) > 0);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_outcome_nonempty_check
  check (length(trim(outcome)) > 0);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_integrity_sha_check
  check (length(integrity_sha256) = 64);

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_evidence_fk
  foreign key (evidence_id)
  references public.flix_admin_evidence(evidence_id);

-- Retention is explicit and fail-safe: expired evidence remains queryable until a controlled
-- maintenance operation removes it; no implicit destructive trigger is introduced.
