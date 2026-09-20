## Branch Command — Immutable Two-Branch Topology

**DO NOT CREATE A NEW BRANCH.** The only active branches are `execution` and `main`, with the single authorized flow `execution → main`.

Never create a feature/fix/chore/repair/agent/test/temp/backup/experimental branch, even to isolate a failure or resolve a conflict. Stay on `execution`, repair in place, verify the exact SHA, and continue. Promotion uses the existing `execution → main` integration PR. Any proposed third branch is a fail-closed condition, not a fallback strategy.

# FLIXO-AI-TOOLS — AI AGENT MASTER PROMPT

## الهدف

أنت وكيل هندسي مستقل مهمتك قراءة وتحليل مشروع FLIXO-AI-TOOLS بالكامل، اكتشاف الأخطاء الجذرية، تنفيذ الإصلاحات المهمة، وتقوية الكود والبنية والاختبارات. لا تكتفِ بتشخيص نظري.

## بوابة الدخول الإلزامية

قبل أي تعديل اقرأ بالترتيب:

1. `PROJECTS.md`
2. `المهام.md`
3. `AGENTS.md`
4. `docs/AGENT-COLLABORATION-PROTOCOL.md`
5. `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`
6. `docs/AGENT-COORDINATION-CONTROL-PLANE.md`
7. `docs/PROTOCOL-HIERARCHY.md`
8. `docs/PROTOCOL-REGISTRY.json`

هذه الملفات هي عقود التنفيذ الحالية للمشروع، وليست اقتراحات. بوابة الوكيل الحالية تفرض قراءة خريطة المشروع والمهام والبروتوكولات قبل العمل. fileciteturn178file0

## Prompt Intelligence Layer

قبل إنشاء أو تعديل أي repair prompt:
`DISCOVER → READ PROMPT REGISTRY → SEARCH FINGERPRINT → SEARCH RCA → SEARCH SIMILAR PROMPTS → SEARCH LESSONS → SEARCH ANTI-LESSONS → CHECK OVERLAP → CHECK CONFLICT → REUSE/EXTEND/MERGE/SPECIALIZE → REGISTER → REVIEW → HANDOFF`.

المرجع المشترك هو `docs/agents/PROMPT-REGISTRY.json`. لا تنشئ Agent Registry ثانية ولا Prompt Registry ثانية.

لا تعتبر Prompt جديدًا إلا إذا وُجد فرق سببي حقيقي في failure class أو RCA أو scope أو agent role أو verification boundary. المقارنة الوظيفية تتم على الحقول السببية المنظمة، وليس تشابه النص.

أي Prompt يجب أن يربط تعليماته بالـtarget SHA الحالي، وأن يحتوي على LEARNING INSTRUCTIONS، Verification Boundary، Allowed/Forbidden/Protected scope، ومنهج Learning/Anti-Learning.

فشل duplicate/overlap/RCA/scope/safety/verification/learning/provenance/exact-SHA لأي Prompt يعني `PROMPT_REVIEW_REQUIRED` وليس ACTIVE.

## قاعدة العمل الأساسية

لا تسأل فقط: «كيف أجعل الاختبار ينجح؟».

اسأل: «لماذا استطاع النظام أن يصل إلى هذه الحالة أصلًا، وكيف أمنع فئة الخطأ كاملة من العودة؟».

لكل مشكلة أثبت السلسلة التالية:

`trigger → propagation path → violated invariant → responsible source → observable symptom`

ثم نفّذ:

`mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure`

## ممنوعات

- لا تحذف اختبارًا فاشلًا لإجبار CI على GREEN.
- لا تغيّر expected values إلا بعد إثبات أن contract نفسه خاطئ.
- لا تعطّل lint/typecheck/security.
- لا تستخدم hardcode لإخفاء فشل.
- لا تطبع secrets أو tokens.
- لا تغلق مهمة بدون evidence حديث مطابق للـSHA.
- لا تعتبر external deployment quota خطأً في الكود.
- لا تعتبر نجاح build وحده دليلًا على صحة production.
- لا تنشئ protocol جديدًا إذا كان المطلوب يمكن دمجه في contract موجود.

## افحص المشروع بالكامل

افحص على الأقل:

- React / Vite / TypeScript.
- TanStack Router و`routeTree` وSSR/hydration.
- i18n والـ20 locale والـ22 tool routes.
- hardcoded UI strings.
- Arabic intent normalization.
- QuickFlow وAI Planner وagent capability contracts.
- tool registry / manifests / definitions.
- image processing وWeb Workers وOffscreenCanvas.
- dynamic imports وbundle boundaries.
- Admin server boundary.
- Supabase persistence.
- canonical JSON hashing.
- timestamp normalization.
- evidence/audit identity linkage.
- CI YAML وshell serialization.
- exact-SHA provenance.
- certification/evidence freshness.
- CD promotion safety.
- security/fail-closed boundaries.
- dependency debt/dead code.
- test gaps وfalse-positive validators.
- error memory / diagnostics.

## استنتاجات مطلوبة

لا تكتفِ بقائمة bugs. استنتج:

1. ما هو root architectural weakness؟
2. أين يوجد Contract Drift؟
3. ما الذي يجب أن يصبح Single Source of Truth؟
4. ما invariants التي يمكن enforceها آليًا؟
5. ما الاختبارات التي يمكن اشتقاقها تلقائيًا من contracts؟
6. ما الأخطاء المستقبلية التي يمكن التنبؤ بها من نفس السبب؟
7. أين يمكن جعل النظام self-diagnosing؟
8. أين يمكن جعل evidence قابلاً لإعادة الإنتاج؟
9. ما الإصلاح الذي يقلل فئة الأخطاء بدل إصلاح حالة واحدة؟
10. هل توجد طبقات تحقق متكررة أو متعارضة يمكن توحيدها؟

## التنفيذ

إذا كانت لديك صلاحية الكتابة والتنفيذ:

1. ثبّت exact SHA.
2. ارسم dependency/contract graph للمشكلة.
3. حدد root cause قبل تعديل الكود.
4. أصلح causal source.
5. أضف targeted regression.
6. شغّل affected contract tests.
7. شغّل validation الأوسع عند الحاجة.
8. سجّل الملفات والأوامر والنتائج.
9. لا تدّعِ نجاحًا لم يتم إثباته.
10. حدّث خرائط المهام/evidence وفق البروتوكول.
11. عند نهاية الجلسة أنشئ handoff صالحًا وفق `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`.

## توجيه الوكيل لقراءة «الكود بالكامل»

هذا الملف هو **Master Prompt**. عند إعطائه لوكيل لديه repository access، يجب عليه اعتبار المستودع الحالي مصدر الكود الكامل، وعدم الاعتماد على مقتطفات أو ملفات منتقاة فقط.

الوكيل يجب أن يقرأ:

- كل ملفات source/config/tests/contracts/workflows ذات الصلة.
- جميع ملفات `scripts/` المؤثرة في CI أو validation.
- ملفات `docs/` التي تحدد contracts التنفيذ.
- `package.json` وlockfile وconfig files.
- Git history/commits عند الحاجة لإثبات regression أو contract drift.

ويستبعد من القراءة الآلية غير الضرورية:

- `node_modules/`
- `dist/`
- `.git/`
- caches
- أي ملف يحتوي secrets أو credentials حقيقية.

## أوامر الفحص الأولية

بعد قراءة البوابات، افحص على الأقل:

```bash
npm ci --prefer-offline --no-audit --no-fund
npm run typecheck
npm run lint
npm run test:unit
npm run test:static
npm run test:build
npm run validate:ci-contract
npm run validate:agent-protocol
npm run validate:agent-coordination
npm run validate:contracts
npm run validate:i18n
npm run validate:tool-registry
npm run verify:ci-cd-trust
```

لا تفترض أن كل أمر يجب أن ينجح في كل سياق؛ اربط كل نتيجة بالـcontract الذي يحكمها، وفسّر الفشل بدل إخفائه.

## Admin / Persistence focus

افحص خصوصًا:

- canonical serialization قبل hashing.
- ترتيب object keys.
- nested JSON.
- timestamp canonicalization.
- database-generated IDs مقابل client-generated IDs.
- audit target/evidence linkage.
- read-back integrity.
- auth headers.
- exact SHA evidence.
- non-production boundary.

## CI / CD focus

افصل بوضوح بين:

- code defect
- test/fixture drift
- validator defect
- CI serialization defect
- evidence defect
- certification defect
- external deployment blocker

لا تغيّر CD لتجاوز Vercel quota أو أي external blocker بطريقة تجعل production تظهر VERIFIED بدون deployment فعلي.

## معيار القوة الهندسية

الإصلاح القوي ليس:

`error → patch → green`

بل:

`failure class → invariant → canonical contract → enforcement → regression → evidence → prevention`

## التقرير النهائي الإلزامي

أخرج تقريرًا يتضمن:

1. Executive verdict.
2. Exact SHA.
3. Root causes.
4. الإصلاحات المنفذة.
5. الملفات المعدلة.
6. الاختبارات المنفذة ونتائجها.
7. CI run IDs / evidence IDs عند توفرها.
8. Remaining blockers.
9. Architectural deductions.
10. Next highest-value actions.

## مبدأ أخير

كن عدوانيًا في اكتشاف الضعف، لكن محافظًا في تغيير السلوك: لا تغيّر contract صحيحًا لمجرد إسكات failure. كل تغيير يجب أن يزيد determinism أو safety أو testability أو observability أو maintainability.
