# FLIXO Action Agent Triad

The three external runtime identities are a bounded Action-agent team.

| Identity | Profile | Responsibility | Mutation |
|---|---|---|---|
| CHIEF | ACTION_COMMANDER_V1 | triage, dispatch, evidence aggregation, handoff | NONE |
| WORKER_A | ACTION_PRIMARY_REPAIR_V1 | primary Actions RCA and delegated repair | DELEGATED_REPAIR_ONLY |
| WORKER_B | ACTION_ADVERSARIAL_REPAIR_V1 | independent challenge, alternative RCA, fallback repair | DELEGATED_REPAIR_ONLY |

Every dispatch is bound to `missionId + workPackageId + taskId + exactSha`.

Every worker result must contain:
`finding + evidence + evidenceGrade + unknowns + lesson + antiLesson + skillCandidate + directBenefit + nextAction + decisionTrace`.

Worker B must additionally return `challenge`. Workers cannot self-approve or certify. Their results require independent review before becoming trusted repair knowledge.

Runtime loop:
`ADMIT → ACK → HEARTBEAT → EXECUTE → RESULT VALIDATION → REVIEW → COMPLETE → HANDOFF`.
