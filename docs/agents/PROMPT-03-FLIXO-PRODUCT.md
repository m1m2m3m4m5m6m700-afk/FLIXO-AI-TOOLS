# PROMPT-03 — FLIXO PRODUCT, PLATFORM & AGENT BUILD

STATUS: CANONICAL PRODUCT / DEVELOPMENT PROMPT
ROLE: Product architecture + implementation
EXECUTION LANE: execution only

## Mission

نفّذ كل مهام المنتج والمنصة والوكيل والـregistry والأداء والإدارة والمعرفة ضمن هذا البرومبت، فوق المصادر الموجودة، بدون إنشاء أنظمة موازية.

CORE PRODUCT FLOW:
User → Chat → Intent Router → Deterministic Planner → Canonical Registry → Execution Gate → Executor → Verifier → Result → Creative Memory

Chat/LLM is not Execution Authority.

## PROMPT-03 task ownership
- FLIXO-IMAGE-AGENT-MASTER-001
- ADMIN-006
- PLATFORM-ARCH-001
- CAPABILITY-BUILDER-001
- CAPABILITY-BUILDER-002
- FLIXO-PLATFORM-001
- FLIXO-PLATFORM-002
- FLIXO-PLATFORM-003
- FILTERS-001
- VIDEO-FILTERS-001
- PERFORMANCE-ENGINE-001
- PERFORMANCE-COMPETITIVE-001
- FINAL-QA-001
- RESPONSIVE-UI-001
- AGENT-FALLBACK-001
- FILTER-MASK-001
- ADMIN-CONTROL-PLANE-REAL-001
- BIG-001
- BIG-002
- FLIXO-PLATFORM-004
- FLIXO-PLATFORM-005
- PLATFORM-001
- PLATFORM-002
- PLATFORM-003
- PR-752-IMAGE-AGENT-SCOPE-001
- ADMIN-PERSISTENCE-PROVENANCE-001
- I18N-RUNTIME-B1B2B3-001
- TOOL-DEFINITION-D004-001
- WP1-REGISTRY-ENGINE-001
- WP3-UNDERSTAND-PLAN-CONFIRM-001
- WP4-EXECUTE-VERIFY-RECOVER-001
- WP6-PERFORMANCE-LOCAL-FIRST-001
- WP7-SEO-I18N-RELEASE-001
- AGENT-KNOWLEDGE-000..013
- PERFORMANCE-BUNDLE-001
- EXTERNAL-GPT-BRIDGE-001
- FLIXO-IMAGE-INTELLIGENCE-001
- PRODUCT-CYCLE-2026
- D-004
- D-005
- D-006
- D-007

## Product architecture
- WP1: single Tool Loader/Registry, indexed discovery, deterministic ordering, validation, metadata-driven executor/verifier and I/O/recovery contracts.
- WP3: intent normalization, parameter extraction, missing-info loop, IntentPlan, Plan Guard, confirmation and QuickFlow/AI fallback.
- WP4: executor, pre/postconditions, ToolOutputContract, verifier, bounded retry/replan and context continuity.
- WP6: reproducible profiling, local-first execution, lazy heavy dependencies, Worker/WASM/WebGPU where proven, and resource/CWV budgets.
- WP7: SEO, localization, engine pages, linking, structured data, search evidence and release gate integration.

## Capability and editing rules
- Every capability/effect is CONTRACT → REGISTRY → EXECUTION → VERIFICATION → QA → PERFORMANCE → SECURITY/PRIVACY → ERROR MEMORY.
- No invented Tool ID, Capability ID or parameters.
- Unavailable or unimplemented effects must be explicit UNAVAILABLE/specified, never presented as production-ready.
- Additions reuse existing shared engines; a new engine requires Gap Evidence.

## Video / Filter scope
VIDEO-FILTERS-001 covers browser-first camera/upload, device capability checks, live preview, recorded processing, 60+ usable effects target, 150 canonical effect architecture, optional face tracking, safe resource budgets, audio preservation, export and output verification.
FILTER-MASK-001 covers the three existing filter-mask execution parts with one canonical registry/resolver/scheduler path.
No artificial 30-second product limit; runtime is resource-bounded.

## Admin and persistence
Secure session/auth boundary, durable provenance, evidence/audit read-back, freshness, controlled production identity and exact-SHA write/read-back. Production write/deploy/rollback remains contract-locked.

## Knowledge
AGENT-KNOWLEDGE-000..013 covers baseline, Knowledge Fabric, retrieval/ranking, graph, authority/conflict, ingestion, memory/privacy, evidence answering, reasoning/planning, tool intelligence, learning, supervision, evaluation and evolution.
Knowledge = decision support. Current CI Evidence = proof. Certification = authority.

## Performance, i18n and UX
Arabic/English parity, scoped observers, mobile/desktop responsiveness, bundle boundaries, local-first processing, memory/resource safety and reproducible performance evidence.

## Inter-prompt contract
Any RED from PROMPT-03 → PROMPT-02.
Any implementation completion → PROMPT-01.
Any product work blocked by GREEN dependency remains OPEN/BLOCKED; never mark complete from implementation alone.

NO SECOND REGISTRY. NO SECOND EXECUTION ENGINE. NO SECOND QA ENGINE. NO AUTHORITY BYPASS.