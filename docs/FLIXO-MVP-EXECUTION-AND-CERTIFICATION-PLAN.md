# FLIXO — خطة التنفيذ التنفيذية لـ Codex (20 Prompts)

> **حالة الخطة:** ACTIVE / EXECUTABLE
>
> **الفرع المسموح للتنفيذ:** `execution` فقط.
>
> **مسار التكامل الوحيد:** `execution → main`.
>
> **قاعدة البداية:** Codex يبدأ من PROMPT 01 فورًا. لا يعيد تنفيذ ما ثبت على الـexact SHA الحالي؛ يفحص أولًا ثم ينفذ GAP الحقيقي فقط.
>
> **قاعدة الإثبات:** لا يُقبل أي PASS أو GREEN أو Certification اعتمادًا على SHA قديم أو evidence stale. skipped/cancelled/neutral/pending لا تساوي نجاحًا.
>
> **قاعدة mutation:** كل mutation على `execution` فقط. لا direct write إلى `main`. أي workflow/security mutation يتطلب المسار المقرر للمراجعة البشرية.
>
> **قاعدة الانتقال:** بعد كل Prompt: Inspect exact SHA → GAP-only mutation → Verify → record new SHA → invalidate previous evidence → continue.
>
> **قاعدة التوقف:** إذا ظهر BLOCKER حقيقي، لا تُخفه ولا تتجاوزه؛ أصلحه ضمن نطاق Prompt الحالي إن كان داخله، وإلا أنشئ إصلاحًا محدد النطاق ثم أعد التحقق.
>
> **قاعدة النطاق:** لا feature expansion، ولا second registry، ولا second executor authority، ولا bypass للـexecution gate، ولا تعديل الاختبارات لإخفاء فشل runtime.

## 0. الهدف النهائي

الوصول إلى Release Candidate واحد قابل للإثبات يحقق:

- Agent Guided Workflow كامل.
- Manual Standalone Workflow مستقل.
- Browser/Worker-local file processing.
- عدم إرسال raw File/Blob bytes إلى provider أو backend.
- Canonical Registry واحد.
- Canonical Execution Gate واحد.
- Canonical Executor authority واحدة.
- Verifier وOutput Contract قابلان للإثبات.
- bounded recovery/fallback مع fail-closed.
- Security وprivacy وresource bounds.
- Acceptance corpus عربي/إنجليزي.
- Clean-clone Red Team.
- Exact-SHA CI.
- Production identity verification عند وجود deployment.
- Certification فقط عندما تتطابق الأدلة على candidate واحد.

## 1. ترتيب التنفيذ الإلزامي

`01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20`

لا تعمل الوحدات عشوائيًا. يجوز تجاوز mutation في Prompt ثبت PASS على **نفس exact SHA** بعد فحصه، لكن يجب تسجيل PASS/EVIDENCE ثم الانتقال للذي يليه.

---

# PROMPT 01 — Exact-SHA State Reconciliation

أنت Agent مسؤول عن State Reconciliation فقط.

Repository:
`m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`

اعمل على `execution` فقط.

المطلوب:

1. اقرأ current `main` وcurrent `execution`.
2. استخرج PR head/base.
3. استخرج جميع required GitHub checks للـcurrent candidate.
4. افحص آخر SHA فعلي فقط.
5. حدد أي evidence قديم أصبح stale.
6. لا تعدّل الكود.
7. أنشئ تقريرًا واحدًا:
   - CURRENT_MAIN_SHA
   - CURRENT_EXECUTION_SHA
   - PR_HEAD_SHA
   - PR_BASE_SHA
   - REQUIRED_CHECKS
   - PASS/FAIL لكل check
   - BLOCKERS
   - STALE_EVIDENCE
   - NEXT_EXECUTION_PROMPT

قاعدة: لا تعتبر skipped/cancelled/stale evidence نجاحًا.

لا تعلن GREEN أو Certification.

**Exit:** state reconciliation exact-SHA مكتمل، أو BLOCKER موثق.

---

# PROMPT 02 — Canonical MVP Scope Closure

أنت Agent مسؤول عن حسم وتوحيد نطاق MVP فقط.

افحص:

- canonical capability registry
- tests
- GPT
- AGENTS.md
- docs
- README
- package/config
- PR/release documentation

النطاق التنفيذي الحالي المسجل في `GPT` هو عشرة capabilities:

- background-remover
- image-upscaler
- image-cropper
- image-compressor
- image-converter
- image-effects
- video-trimmer
- video-cropper
- video-resizer
- video-compressor

لا تفترض صحة القائمة؛ أثبتها من الواقع التنفيذي.

لكل capability صنّف:

- EXECUTABLE
- READY
- LOCAL
- browser-compatible
- verifier-backed
- output-contract-backed

ثم أنشئ/حدّث Scope Decision Record واحدًا.

بعد القرار المدعوم بالأدلة:

1. canonical registry متوافق.
2. tests متوافقة.
3. GPT متوافق.
4. AGENTS/docs متوافقة.
5. release checklist متوافق.
6. CI contradiction test يمنع وجود تعريفين فعليين للـMVP.

لا تنشئ registry ثانية.
لا توسع MVP لمجرد وجود capability.
لا تحذف capability مستخدمة runtime دون dependency proof.

**Verification:** typecheck + tests + scope contradiction test + build.

**Exit:** scope واحد canonical، أو BLOCKER موثق.

---

# PROMPT 03 — Registry → Gate → Executor → Verifier Audit

أنت Agent مسؤول عن execution contract audit.

لكل capability معلنة كـMVP أثبت:

`Registry → Execution Gate → Canonical Executor → Verifier → Output Contract → Artifact`

تحقق من:

- EXECUTABLE
- READY
- LOCAL
- network=false
- browser/browser-worker execution mode
- executorId
- outputContractId
- parameterSchema
- verifier
- safetyLimits

ابحث عن أي shortcut داخل Agent Editor أو أي executor authority موازية.

إذا وجدت bypass:

1. لا تخفِه.
2. حدد الملف والمسار.
3. أصلحه باستخدام canonical architecture.
4. أضف regression test.

ممنوع:

- second registry
- second executor authority
- bypass للـexecution gate
- fake verifier
- تعديل الاختبار بدل إصلاح contract

**Exit:** كل MVP capability لها canonical execution path مثبت، أو blocker.

---

# PROMPT 04 — Agent + Manual Workflow E2E Closure

أثبت استقلال المسارين.

A:
`Upload → Natural Language → Intent → Parameters → Plan → Canonical Capability → Execution Gate → Executor → Verifier → Result`

B:
`Browse Tools → Tool → File Input → Execute → Output`

اختبر:

1. valid image request
2. Arabic request
3. English request
4. compound request
5. ambiguous request
6. unsupported operation
7. execution failure
8. manual fallback
9. direct manual tool usage

في Agent path:

provider failure أو malformed provider output لا يؤدي إلى execution غير مؤكد.

النهاية المسموحة:
- deterministic local plan
- manual fallback
- explicit failure

لا تجعل manual workflow يعتمد على Agent.

نفذ Browser/E2E على exact SHA.
لا تعتمد على UI existence فقط؛ أثبت execution وoutput.

**Exit:** كلا المسارين مثبتان end-to-end، أو blocker.

---

# PROMPT 05 — Prompt / Provider Trust Boundary

أنت Agent مسؤول عن Trust Boundary فقط.

أثبت:

System Prompt = trusted policy/instructions فقط.

Assistant Context = conversation/task state فقط.

Untrusted Content لا يستطيع رفع نفسه إلى system authority.

اختبر:

- prompt injection
- malicious layer labels
- malformed provider response
- malformed tool call
- invalid parameters
- provider output attempting unauthorized capability
- failover context contamination

أثبت أن LLM = reasoning/proposal only، ولا يمتلك:

- raw File/Blob bytes
- registry authority
- executor authority
- verifier authority

أي violation يُصلح في canonical boundary.

أضف regression coverage.

**Exit:** trust boundary مثبتة، أو blocker.

---

# PROMPT 06 — Browser-Local Media Execution

أثبت أن file transformation ضمن MVP يحدث محليًا في Browser/Worker.

المسار المطلوب:

`File → decode → bounded processing → worker/local executor → Blob → verifier → artifact`

طبّق/تحقق من:

- max file size
- max pixels
- timeout
- AbortSignal
- worker lifetime
- output size limit
- MIME validation
- signature validation
- dimensions validation

استخدم Web Worker عندما يكون processing قادرًا على blocking الـUI، خصوصًا effects/video.

أثبت عمليًا أن raw image/file bytes لا تُرسل إلى provider endpoint.

أضف tests لـresource exhaustion وabort وinvalid output.

لا تنشئ backend file-processing path بديل.

**Exit:** local execution + bounds + privacy proof، أو blocker.

---

# PROMPT 07 — Acceptance Corpus

أنشئ/أكمل versioned acceptance corpus.

Image:

- compression
- conversion
- upscale
- crop
- effects
- background removal

لكل capability:
Arabic + English.

أضف:

- compound commands
- parameter extraction
- ambiguous commands
- conflicting parameters
- malformed parameters
- unsupported formats
- unsupported operations
- oversized dimensions

لـeffects يجب وجود regression cases صريحة لـ:

- contrast Arabic
- brightness Arabic
- saturation Arabic
- grayscale Arabic
- English equivalents
- compound effects
- negative/ambiguous effect requests

Negative corpus يجب أن ينتج:
null / fallback / explicit error

وليس guess.

أي تغيير يمر عبر canonical planner/capability layer.

**Exit:** corpus versioned ومربوط بالـcanonical layer، أو blocker.

---

# PROMPT 08 — Output + Visual Goal Verification

أنت Agent مسؤول عن verification فقط.

ارفع Output Contract من مجرد `output exists` إلى خصائص قابلة للإثبات.

تحقق من:

- MIME
- extension
- filename
- signature
- size
- dimensions
- video metadata عند applicable

أضف visual-semantic verification حيث يمكن قياس الهدف.

الحد الأدنى:

- resize geometry
- crop geometry
- grayscale
- brightness
- contrast
- saturation
- meaningful effects change

لا تعتبر `output.size > 0` دليلًا كافيًا عندما يمكن إثبات خاصية أقوى.

أضف regression tests لكل verifier.

لا تسمح للـverifier بإعلان نجاح غير قابل للإثبات.

**Exit:** output + visual verification evidence، أو blocker.

---

# PROMPT 09 — Coverage Certification

أنت Agent مسؤول عن coverage فقط.

ابدأ من exact current SHA.

تحقق من:

- coverage generation
- Agent Editor coverage
- provider router
- adapters
- agent runtime
- local executor
- media worker
- security parsing
- failover
- output verification
- browser-critical paths

لا تضف tests سطحية لرفع الرقم.

إذا كان Codecov يتطلب `CODECOV_TOKEN`:

1. افحص repository policy/workflow.
2. إذا كانت tokenless policy مدعومة ومقصودة، وثّقها رسميًا.
3. وإلا أعد إعداد secret الصحيح وفق صلاحيات المستودع.

ممنوع:

- missing token = success
- تجاهل upload failure
- إزالة protection
- `|| true`
- skip coverage

أعد coverage على SHA جديد بعد أي mutation.

**Exit:** coverage evidence حقيقي، أو blocker.

---

# PROMPT 10 — Security Closure

أنت Agent مسؤول عن Security Hardening.

راجع:

- input size
- request body limits
- parameter schema
- provider URL allowlist
- provider timeout
- provider response limits
- SSE correctness
- credential encryption
- secret isolation
- CSP
- Permissions Policy
- security headers
- workflow permissions
- action SHA pinning
- worker resource bounds
- output resource limits

ثم شغّل:

- CodeQL
- dependency/security audit
- secret scanning

كل failure يجب أن يكون:

- real
- classified
- traceable
- fixed أو explicitly documented blocker

ممنوع masking أو bypass.

أخرج Security Evidence exact SHA.

**Exit:** security evidence exact-SHA، أو blocker.

---

# PROMPT 11 — CI / Workflow Simplification

راجع جميع workflows.

صنّف كل workflow:

- verify
- browser
- security
- coverage
- deploy
- repair-only
- release

ابحث عن:

- duplicate execution
- duplicate certification
- duplicate registry
- duplicate repair
- obsolete swarm logic
- self-trigger loops
- stale SHA assumptions

لا تحذف workflow إلا بعد إثبات عدم وجود runtime/required-check dependency.

أي workflow mutation:

1. exact SHA
2. inspect callers/dependencies
3. modify execution
4. run affected checks
5. run canonical CI
6. verify no required check disappeared

الهدف تقليل التعقيد، وليس حذف الإثباتات.

**Exit:** workflow graph coherent، أو blocker.

---

# PROMPT 12 — Main Governance Hardening

راجع Ruleset الخاص بـmain.

طابق policy الفعلية مع:

- protected main
- no direct push
- required approving review
- Code Owner review عند الحاجة
- strict required status checks
- stale review policy
- PR source restrictions
- merge queue عند الحاجة

لا تعدّل main مباشرة.

افحص actual GitHub ruleset configuration.

إذا كانت الصلاحيات تمنع التعديل:
لا تختلق PASS.

أخرج:

CURRENT POLICY
REQUIRED POLICY
GAP
SAFE MUTATION
VERIFICATION

أي change يجب أن يكون قابلًا لإعادة التحقق.

**Exit:** governance evidence، أو blocker.

---

# PROMPT 13 — Evidence-Based Repository Hygiene

نفذ cleanup محدودًا ومدروسًا.

ابحث عن:

- dead code
- obsolete docs
- duplicate contracts
- stale certification claims
- old registries
- old mock executors
- obsolete swarm artifacts
- inconsistent FLIXO naming
- obsolete product names
- duplicate configuration

لكل حذف:
أثبت أولًا أنه ليس runtime dependency.

لا تنفذ refactor شامل.

بعد cleanup:

- tests
- typecheck
- lint
- build
- browser smoke

أي documentation certification claim يجب أن يشير إلى current exact SHA أو يكون policy/instruction لا claim.

**Exit:** hygiene completed without runtime regression، أو blocker.

---

# PROMPT 14 — Documentation Authority Alignment

وحّد سلسلة الوثائق:

`README → product`

`GPT → architectural mandate/shared agent context`

`AGENTS.md → agent execution contract`

`المهام.md → backlog/scope state`

`PROJECTS.md → project map`

`docs/ → technical design/evidence`

راجع كل claim حالي.

أزل أو صحح:

- stale SHA
- stale status
- obsolete MVP scope
- obsolete architecture
- false certification
- duplicate authority claim

لا تحول documentation إلى second source of truth للـruntime.

canonical runtime remains the authority.

**Exit:** documentation aligned، أو blocker.

---

# PROMPT 15 — Deployment / Production Identity

أثبت:

`main exact SHA → certified build artifact → production deployment → immutable identity → production browser verification`

يجب إثبات:

- deployment SHA
- build artifact identity
- worker identity
- production URL response
- production browser smoke

لا تعتبر deployment من execution = production truth.

افحص العلاقة بين:

- Cloudflare
- Vercel
- Browser runtime

وأثبت أن file processing يبقى browser-local.

أي mismatch:
FAIL CLOSED.

لا تعلن production certification قبل تطابق identity.

**Exit:** deployment lineage verified، أو blocker / NOT APPLICABLE موثق.

---

# PROMPT 16 — Supabase / Persistence Boundary

افحص كل persistence dependency.

صنف كل استخدام:

- MVP-required
- optional
- stateless
- admin-only
- Post-MVP

أثبت أن local image/file editing لا يحتاج Supabase prerequisite.

إذا كان هناك implicit dependency:
أزل dependency من local execution path أو اجعله explicit optional.

لا تحذف persistence features المستخدمة فعليًا دون dependency analysis.

أضف regression test يثبت أن MVP editing يعمل بدون persistence service.

**Exit:** persistence boundary مثبت، أو blocker.

---

# PROMPT 17 — Clean-Clone Final Red Team

هذا اختبار نهائي وليس feature development.

ابدأ من clean checkout للـcandidate SHA.

لا تستخدم:

- cached assumptions
- previous session state
- stale artifacts
- previous test results

نفذ من الصفر:

1. checkout exact SHA
2. install
3. typecheck
4. lint
5. core tests
6. MVP acceptance corpus
7. Agent tests
8. Browser E2E
9. security checks
10. CodeQL
11. coverage
12. artifact verification
13. exact SHA verification
14. production/deployment identity verification عند وجود candidate deployment

اختبر:

- Agent workflow
- Manual workflow
- fallback
- privacy
- malformed provider output
- prompt injection
- oversized input
- invalid parameters
- worker abort
- provider failover
- output corruption
- stale SHA protection

لا تصلح أثناء الاختبار.

سجل كل failure كما هو.

إذا فشل أي required gate:
الحالة FAIL، ثم أنشئ Prompt إصلاح واحدًا محدد النطاق.

**Exit:** Red Team PASS على candidate واحد، أو FAIL مع blocker/repair prompt.

---

# PROMPT 18 — Release Candidate Freeze

بعد نجاح Final Red Team فقط.

حوّل `execution` إلى Release Candidate Freeze.

من هذه النقطة يمنع:

- feature work
- architecture expansion
- new capabilities
- registry expansion
- unrelated refactor

المسموح فقط:

- bug fixes
- security fixes
- contract-correcting tests
- documentation corrections

أنشئ Release Candidate Evidence Record يحتوي:

- CURRENT SHA
- TESTED SHA
- BUILT SHA
- BROWSER VERIFIED SHA
- SECURITY VERIFIED SHA
- COVERAGE VERIFIED SHA
- DEPLOYMENT SHA
- SCOPE ID
- REQUIRED CHECKS

كلها يجب أن تكون لنفس candidate lineage.

**Exit:** freeze record كامل، أو blocker.

---

# PROMPT 19 — Final Certification Gate

أنت Certification Evidence Agent.

لا تعدّل الكود.

تحقق من candidate SHA النهائي فقط.

يجب أن تكون:

- Current SHA
- Tested SHA
- Built SHA
- Browser Verified SHA
- Certified SHA

وإذا كان production deployment موجودًا:

- Deployed SHA

تحقق من:

Code:
- typecheck PASS
- lint PASS
- build PASS

Tests:
- core PASS
- MVP corpus PASS
- agent PASS
- browser PASS
- red-team PASS

Security:
- CodeQL PASS
- security audit PASS
- secret scanning PASS
- workflow integrity PASS

Coverage:
- coverage PASS
- Codecov PASS أو documented approved policy

Governance:
- required review satisfied
- main protected
- required checks strict
- no direct main mutation

Scope:
- one MVP scope
- no hidden executable capability
- one registry
- one executor authority
- one execution gate

Deployment:
- exact SHA identity
- production response
- production browser proof عند وجود deployment

إذا كانت كل الشروط PASS:
أنشئ Certification Evidence فقط.

إذا كان أي شرط ناقصًا:
`CERTIFICATION = NOT READY`
وسجّل blocker بدقة.

لا تستخدم كلمة CERTIFIED إذا لم تتطابق كل الأدلة.

**Exit:** CERTIFICATION EVIDENCE أو NOT READY.

---

# PROMPT 20 — Owner-Authorized Final Promotion

نفذ فقط بعد اكتمال Prompt 19 ووجود Certification Evidence صالح.

المالك البشري أعطى authorization للتكامل.

قبل promotion:

1. اقرأ current exact candidate SHA.
2. تحقق من required checks على نفس SHA.
3. تحقق من PR head/base.
4. تحقق من no stale evidence.
5. تحقق من branch protection.
6. تحقق من release candidate freeze.

استخدم فقط:

`execution → main`

ولا تستخدم direct main write.

بعد التكامل:

1. احصل على new main SHA.
2. أعد canonical CI على main.
3. أعد exact-SHA verification.
4. تحقق من production deployment identity.
5. نفذ production browser smoke.
6. تحقق من أن deployed SHA = certified release lineage.

أي mismatch بعد merge:
لا تعلن نجاحًا؛ افتح إصلاحًا جديدًا على `execution`.

**Exit:** Promotion verified أو FAIL-CLOSED مع blocker.

---

# 2. بروتوكول Codex الإلزامي بين الوحدات

لكل Prompt:

1. **INSPECT**
   - current branch
   - current exact SHA
   - relevant files
   - existing implementation
   - latest evidence فقط

2. **DECIDE**
   - PASS: إذا كان الشرط مثبتًا على exact SHA الحالي.
   - GAP: إذا كان التنفيذ ناقصًا.
   - BLOCKER: إذا تعذر الإغلاق ضمن نطاق الوحدة أو بسبب صلاحية خارجية.

3. **MUTATE**
   - execution فقط.
   - GAP فقط.
   - لا scope creep.
   - لا bypass.
   - لا fake green.

4. **VERIFY**
   - شغّل الاختبارات ذات الصلة.
   - شغّل canonical checks المطلوبة.
   - سجّل النتائج على SHA الجديد.

5. **INVALIDATE**
   - أي mutation ينشئ SHA جديدًا.
   - الأدلة السابقة لا تُستخدم لإثبات الـnew SHA.

6. **RELAY**
   - انتقل للوحدة التالية فقط بعد تسجيل:
     `PROMPT_ID / SHA / STATUS / EVIDENCE / BLOCKERS / NEXT_PROMPT`

## 3. سجل الحالة المطلوب

استخدم هذا الشكل في evidence/agent state، دون تحويله إلى source of truth runtime:

```text
PROMPT_ID=
START_SHA=
END_SHA=
STATUS=PASS|GAP|BLOCKER|NOT_READY
MUTATED=true|false
TESTS=
REQUIRED_CHECKS=
EVIDENCE=
STALE_EVIDENCE_INVALIDATED=
BLOCKERS=
NEXT_PROMPT=
```

## 4. قواعد عدم التضخم

- IMPLEMENTED ≠ VERIFIED.
- VERIFIED على SHA قديم ≠ VERIFIED على SHA جديد.
- CI job success منفرد ≠ GLOBAL GREEN.
- skipped/cancelled ≠ PASS.
- UI visible ≠ execution proven.
- output exists ≠ output verified.
- provider response ≠ execution authority.
- documentation claim ≠ runtime evidence.
- deployment exists ≠ production certified.
- historical baseline ≠ current state.

## 5. Authority model

Runtime authority:

- Canonical capability/tool definitions
- Capability Registry
- Execution Gate
- Canonical Executor
- Output Contract
- Verifier

Agent/LLM:
- reasoning/proposal only.

External workers:
- repair/review evidence only.
- no push/branch/merge/certification authority.

Certification:
- evidence gate only.
- لا تمنح runtime authority.

## 6. Definition of Done

لا تُغلق الخطة إلا عندما:

1. PROMPT 01–19 لها evidence صالح على lineage النهائي.
2. Final Red Team PASS.
3. Release Candidate Freeze موثق.
4. Certification Gate PASS.
5. Owner-authorized promotion تم عبر `execution → main`.
6. Main بعد الدمج خضع لـcanonical CI.
7. production identity، عند وجود deployment، تطابق release lineage.
8. لا توجد stale claims أو hidden executable capabilities.
9. لا يوجد second registry أو second executor authority.
10. لا يوجد direct main mutation.

**النتيجة النهائية المسموحة فقط:**

`RELEASE VERIFIED`

أو:

`NOT READY — BLOCKERS ENUMERATED`

ولا توجد حالة وسطية تحمل اسم GREEN/CERTIFIED.
