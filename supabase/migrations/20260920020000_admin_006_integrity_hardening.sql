-- ADMIN-006 integrity hardening: align the live provider with the evidence/audit contract.
-- Existing rows are retained; constraints are fail-closed for future writes.

alter table public.flix_admin_evidence
  drop constraint if exists flix_admin_evidence_status_check,
  drop constraint if exists flix_admin_evidence_assertion_nonempty_check,
  drop constraint if exists flix_admin_evidence_exact_sha_check,
  drop constraint if exists flix_admin_evidence_source_nonempty_check,
  drop constraint if exists flix_admin_evidence_evaluator_nonempty_check,
  drop constraint if exists flix_admin_evidence_environment_nonempty_check,
  drop constraint if exists flix_admin_evidence_integrity_sha_check;

alter table public.flix_admin_evidence
  add constraint flix_admin_evidence_status_check
    check (status in ('VERIFIED','FAILED','BLOCKED','UNAVAILABLE','STALE','UNKNOWN')),
  add constraint flix_admin_evidence_assertion_nonempty_check
    check (length(trim(assertion_id)) > 0),
  add constraint flix_admin_evidence_exact_sha_check
    check (exact_sha ~ '^[0-9a-f]{40}$'),
  add constraint flix_admin_evidence_source_nonempty_check
    check (length(trim(source)) > 0),
  add constraint flix_admin_evidence_evaluator_nonempty_check
    check (length(trim(evaluator)) > 0),
  add constraint flix_admin_evidence_environment_nonempty_check
    check (length(trim(environment)) > 0),
  add constraint flix_admin_evidence_integrity_sha_check
    check (integrity_sha256 ~ '^[0-9a-f]{64}$');

alter table public.flix_admin_audit_events
  drop constraint if exists flix_admin_audit_actor_nonempty_check,
  drop constraint if exists flix_admin_audit_action_nonempty_check,
  drop constraint if exists flix_admin_audit_target_type_nonempty_check,
  drop constraint if exists flix_admin_audit_target_id_nonempty_check,
  drop constraint if exists flix_admin_audit_exact_sha_check,
  drop constraint if exists flix_admin_audit_environment_nonempty_check,
  drop constraint if exists flix_admin_audit_outcome_check,
  drop constraint if exists flix_admin_audit_integrity_sha_check;

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_actor_nonempty_check
    check (length(trim(actor_subject)) > 0),
  add constraint flix_admin_audit_action_nonempty_check
    check (length(trim(action)) > 0),
  add constraint flix_admin_audit_target_type_nonempty_check
    check (length(trim(target_type)) > 0),
  add constraint flix_admin_audit_target_id_nonempty_check
    check (length(trim(target_id)) > 0),
  add constraint flix_admin_audit_exact_sha_check
    check (exact_sha ~ '^[0-9a-f]{40}$'),
  add constraint flix_admin_audit_environment_nonempty_check
    check (length(trim(environment)) > 0),
  add constraint flix_admin_audit_outcome_check
    check (outcome in ('ALLOW','DENY','SUCCESS','FAILURE','BLOCKED')),
  add constraint flix_admin_audit_integrity_sha_check
    check (integrity_sha256 ~ '^[0-9a-f]{64}$');

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_events_evidence_fk
  foreign key (evidence_id)
  references public.flix_admin_evidence(evidence_id)
  on delete set null;
