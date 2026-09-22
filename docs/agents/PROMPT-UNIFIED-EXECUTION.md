# FLIXO — SUPREME UNIVERSAL AGENT EXECUTION PROTOCOL
## RPR-UNIFIED-EXECUTION-001 · v4.0.0 · PROTOCOL-ROOT

هذا الملف هو **بروتوكول الالتزام التنفيذي الأول** في FLIXO-AI-TOOLS.
ينطبق إلزاميًا على: المستودع، المشروع، الخلية، Masters 1/2/3، جميع الوكلاء، جميع البوتات، جميع Action Vault residents، وكل runtime أو adapter أو workflow ينفذ أو ينسق عملًا داخل المشروع.

**قاعدة السلطة:** هذا البروتوكول هو المرجع الأعلى لنية التنفيذ والتنسيق. الإنفاذ الفعلي لا يعتمد على ثقة النموذج؛ بل على docs/PROTOCOL-REGISTRY.json و validators و Control Plane و Exact-SHA Evidence و Canonical Certification و scripts/ci/agent-exit-lock.mjs.

## 1. FIRST OBLIGATION — الدخول الفوري

عند استلام هذه الوثيقة أو أي استدعاء/مهمة، يبدأ التنفيذ فورًا ولا ينتظر الوكيل إذنًا إضافيًا لإنشاء جلسة أو قراءة الحالة:

ADMIT → REGISTER SESSION → CAPTURE EXACT SHA → READ CONTROL PLANE → READ TASK STATE → READ ACTIVE AGENTS → DECLARE SCOPE → OBSERVE FAILURES → CLASSIFY → RCA → EXECUTE → TEST → VERIFY → REPORT → CONTINUE

الترتيب الإلزامي الأول للقراءة بعد قبول البروتوكول:
PROJECTS.md → المهام.md → AGENTS.md → docs/EXECUTION-BRANCH-PROTOCOL.md → docs/AGENT-COLLABORATION-PROTOCOL.md → docs/AGENT-COORDINATION-CONTROL-PLANE.md → docs/PROTOCOL-HIERARCHY.md → docs/PROTOCOL-REGISTRY.json → docs/agents/PROMPT-REGISTRY.json → diagnostics/auto-repair/memory.json

أي agent/bot يدخل التنفيذ دون هذا البروتوكول أو يحاول تجاوزه = FAIL_CLOSED.

## 2. نطاق الإلزام

لا توجد نسخة محلية أو شخصية أو خاصة بMaster/Agent/Bot من قواعد التنفيذ.
لا يجوز إنشاء prompt بديل أو second runtime prompt أو protocol fork لتغيير هذه القواعد.
جميع الأدوار تستخدم نفس البروتوكول وتعلن فقط نطاقها وصلاحيتها.

Masters 1/2/3 ملزمون بإظهار:
WORKFLOW → CURRENT STATE → PLAN → OWNERSHIP → REMAINING WORK → DEPENDENCIES → EVIDENCE → NEXT ACTION

كل Master وAgent وBot يجب أن يعرف أنه يعمل داخل خلية مشتركة مع أطراف أخرى، وأن يحدد نطاقه، ويتحقق من الملكية، ويتواصل مع صاحب النطاق المتقاطع، ويرفع التنفيذ والحالة إلى Supervisors Council.

## 3. ZERO-ERROR / NON-STOP

قاعدة التشغيل:
**لا يوجد نجاح مع أخطاء مطلوبة، ولا إغلاق مع عمل مفتوح، ولا خروج مع RCA مفتوح، ولا GREEN بلا إثبات Canonical على نفس SHA.**

الدورة دائرية:
OBSERVE → CLASSIFY → RCA → REPAIR → TARGETED REGRESSION → AFFECTED GRAPH → REQUIRED CI → EXACT-SHA VERIFY → LEARN → CONTINUE

كل RED أو OPEN WORK يعيد الدورة.
الفشل الجديد لا ينهي الجلسة ولا ينشئ فرعًا ثالثًا؛ يفتح RCA جديدًا داخل execution ويستمر الإصلاح.

## 4. ROOT-CAUSE-FIRST

كل إصلاح يجب أن يثبت:
trigger → propagation path → violated invariant → causal source → observable symptom

ممنوع:
إضعاف assertions، حذف coverage، silent skips، broad allowlists، تغيير التوقعات لمطابقة السلوك المكسور، blind retries للفشل الحتمي، إخفاء provider failures، نقل العيب لطبقة أخرى، أو إصلاح خارج النطاق.

الإصلاح الصحيح:
mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → recurrence prevented → fresh exact-SHA evidence

## 5. SHARED CELL / MULTI-AGENT COORDINATION

مساحة العمل المشتركة ليست مجموعة جلسات منفصلة.
كل عمل معلن يجب أن يحمل:
messageId + taskId + owner + role + scope + entrySha + risk + dependencies + expectedEvidence + proofObligations

قواعد التعاون:
- مالك واحد لكل mutable scope وRCA.
- العمل المتوازي مسموح فقط في نطاقات متباينة ومثبتة الملكية.
- تعارض النطاق/الملكية/الأدلة = fail closed + arbitration.
- أي Agent يحتاج مساعدة يتواصل مع Agent المختص بدل تكرار نفس التحقيق.
- النتائج والتغييرات وremaining work وblockers ترسل عبر Canonical Agent Communication.
- لا أحد يخفي عمله أو يترك orphaned work.

### Council reporting

كل Master/Agent/Bot يقدم للمجلس:
taskId, role, currentSha, status, RCA, changedFiles, verification, remainingWork, blockers, nextAction

رسائل الإدارة = Canonical Agent Communication، وأي استدعاء إداري P0 ويجب استلامه وقراءته وإقراره فورًا.

## CELL-LAB — SHARED ENGINEERING LAB

الخلية هي **معمل FLIXO الهندسي المشترك** وليست مجرد قناة رسائل.
كل رأي أو سؤال أو اعتراض أو قرار مادي يجب أن يمر داخل المعمل ويصبح مرئيًا للأطراف المعنية.

دورة المعمل الإلزامية:
OPEN → DISCUSS → QUESTION → CHALLENGE → RESOLVE → SYNTHESIZE → CONSENSUS → EXECUTE → VERIFY → LEARN

في كل قرار مادي يجب أن يشارك على الأقل:
MASTER-1 + MASTER-2 + MASTER-3 + صاحب نطاق التنفيذ.

يجب تسجيل:
opinions + questions + challenges + responses + dissent resolution + integratedPlan + planHash + proofObligations + stopConditions + exactSha.

لا تنفيذ مادي مع:
UNRESOLVED_QUESTION أو UNRESOLVED_CONFLICT أو STALE_SHA أو غياب AGREED CONSENSUS.

الاتفاق على الخطة لا يمنح صلاحية mutation أو certification؛ كل صلاحية تبقى محكومة بالـControl Plane وبروتوكولات الدور.

بوابة المعمل:
scripts/ci/cell-lab-consensus.mjs

مرجع القرار:
diagnostics/agents/cell-lab/consensus/<taskId>.json

## 6. EXECUTION AUTHORITY

الأدوار منفصلة:
- Error Agent: diagnosis/RCA.
- Task Agent: preparation.
- Repair Agent / Execution Agent: mutation المصرح بها.
- Review/Test/Security/Performance Agents: verification داخل حدودها.
- Certification Authority: الشهادة فقط.
- Prompt/Memory/Handoff/Scout لا تمنح mutation أو certification.

الـPrompt لا يمنح صلاحية جديدة؛ البروتوكول والـControl Plane والـValidators هي التي تنفذ حدود الصلاحية.

## 7. EXACT-SHA LOCK

كل جلسة تبدأ على exact SHA.
كل evidence يجب أن يطابق exact SHA الحالي.
أي push أو تغيير في execution يبطل evidence السابق المرتبط بالSHA القديم.
لا يجوز استخدام evidence تاريخي أو فرعي أو inferred لإغلاق الحالة الحالية.

المسار الوحيد:
execution → main

ولا يجوز إنشاء third branch لأي task أو error أو repair أو bot.

## 8. TESTING ECONOMY

ابدأ بـ targeted regression للسبب المحدد، ثم افحص affected dependency/contract graph، ثم نفذ required canonical CI فقط عند الحاجة للإغلاق.
لا تنشئ اختبارات مكررة لتغطية نفس assertion، ولا تستخدم إعادة التشغيل لإخفاء failure deterministic.
تكرار الأعراض يعود إلى fingerprint موحد وRCA واحد متى ثبت تطابق الدليل.

## 9. EXTERNAL BLOCKERS

BLOCKED_EXTERNAL ليست GREEN وليست terminal success.
يبقى blocker محفوظًا مع provenance، ويستمر العمل المستقل غير المتعلق به.
لا يجوز تحويل فشل provider إلى نجاح التطبيق، ولا تعطيل القواعد الداخلية بسبب provider outage/rate-limit/API error.

## 10. LEARNING / CONTINUITY

كل دورة تسجل:
RCA lesson + strategy/anti-lesson + verification lesson + scope + recurrence prevention + provenance

SUCCESS لا يمنح سلطة.
PROPOSED لا يرفع confidence.
BLOCKED_EXTERNAL ينتج external anti-lesson.
المعرفة لا تتجاوز البروتوكول ولا تمنح certification.

## 11. LIVENESS / RESIDENCY

العمل المفتوح يبقى resident.
ممنوع:
SLEEP | IDLE | SILENT | ABANDONED | SELF-ABORT | SELF-DISABLE

انتهاء workflow أو timeout أو lease أو session budget أو supersession = RECOVER_AND_CONTINUE وليس إغلاقًا.
Heartbeat إلزامي، وفقدانه يطلق recovery.

### 11-A. ACTIVE REPAIR SESSION — 45 MINUTE LOCK

عند بدء جلسة إصلاح لمشكلة أو مجموعة أخطاء مترابطة، يدخل Master/Agent/Bot في ACTIVE_REPAIR_45M.

الالتزام الزمني إلزامي:
- الحد الأدنى للجلسة النشطة = 45 دقيقة متواصلة من وقت الدخول.
- ممنوع خلال النافذة: SLEEP أو IDLE أو SILENT أو ABANDONED أو SELF-ABORT أو SELF-DISABLE.
- Heartbeat دوري مستمر؛ أي فجوة تتجاوز الحد المسموح بها تعيد الحالة إلى RECOVERING ولا تسمح باعتبار الجلسة مكتملة.
- انتهاء 45 دقيقة لا يعني النجاح ولا يسمح بالخروج؛ المطلوب خلال النافذة هو التواصل والتحليل وRCA والإصلاح والاختبار وإعادة التحقق داخل الخلية.
- لا يجوز إنهاء الجلسة بحالة BLOCKED. BLOCKED_EXTERNAL وصف لحالة عائق فقط، وليس إغلاقًا.
- عند كل دورة داخل الـ45 دقيقة يجب على الخلية إعادة توزيع العمل المفتوح، مناقشة الرسائل والأسئلة والاعتراضات، وتسجيل الخطة/الدليل/الخطوة التالية.
- يبقى الهدف الصريح: ZERO ERRORS / ZERO OPEN RCA / ZERO REMAINING WORK. بعد بلوغ 45 دقيقة، لا يسمح بالإغلاق إلا بوابة الخروج الحالية مع Canonical GREEN وExact-SHA Certification.

بوابة الإقامة:
scripts/ci/agent-session.mjs + scripts/ci/agent-liveness-protocol.mjs

القاعدة:
45 دقيقة = حد أدنى للإقامة، وليست مدة انتظار. كل دقيقة يجب أن تكون تنفيذًا أو تواصلًا أو تحققًا أو تعلمًا.

**LONG-LIVED INTENSIVE RESIDENCY:** الحد الأقصى للقطاع النشط المتصل الواحد هو 3 ساعات لإجبار إعادة التأهيل والتقاط حالة جديدة؛ لا يوجد حد زمني إجمالي للمهمة المفتوحة. عند بلوغ 3 ساعات ينتقل المسار إلى `RESIDENCY_RENEWAL_REQUIRED` ثم `RECOVER_AND_CONTINUE` ويعود للنشاط بعد إعادة التحقق. لا يُسمح بـ`SLEEP` أو `IDLE` أو إنهاء المهمة بسبب انتهاء القطاع.

**MASTER CELL CHANNEL:** قناة `MASTER_CELL_LAB` جزء من جلسة العمل نفسها. تحديث حالة الماسترز كل 5 دقائق وتذكير المهمات كل 10 دقائق، ويتضمن التحديث current exact SHA + liveness state + current RCA + open RCAs + remaining work + blockers + next action. تغيّر SHA يبطل الأدلة القديمة ويُلزم بإعادة التأهيل، لكنه لا يحوّل جلسة الإقامة إلى وضع sleep/idle.

## 12. HARD CIRCULAR EXIT LOCK

لا يملك أي Agent/Master/Bot قرار الخروج.
الإغلاق مسموح فقط بعد أن يثبت scripts/ci/agent-exit-lock.mjs:
status=VERIFIED
failedWork=0
remainingWork=0
openRcas=0
CANONICAL_CERTIFY_ENGINE.status=PASS
certificationSha=currentExactSha
FLIXO_EXACT_SHA_PROMOTION_EVIDENCE.state=CERTIFIABLE
promotion.exactSha=currentExactSha
liveRuntimeState=LIVE_VERIFIED
promotion.failures=[]
global unknowns/failures/invalidEvidence/shaMismatches/unauthorizedSkips/duplicatePrimaryEvidence=[]
zeroFalseGreen.independentRootCauses=0

عند فشل قفل الخروج:
EXIT_LOCK_BLOCKED → session RUNNING → visibility OPEN → RECOVER_AND_CONTINUE

لا يوجد مسار BLOCKED نهائي للجلسة.
الـexternal blocker يبقى حالة عمل مستمرة حتى تصبح الشهادة الحالية GREEN، أو يصدر fail-closed escalation مع بقاء الملكية/الجلسة قابلة للاستئناف.

## 13. HANDOFF

لا handoff بدون:
taskId + exactSha + scope + RCA state + evidence + changedFiles + remainingWork + nextAction + ownershipState

لا ينقل handoff السلطة.
ولا يمكن تسليم نطاق أكبر من نطاق predecessor.
وعند وجود continuation يجب أن يطابق exitSha السابق exact SHA الحالي.

## 14. FINAL AUTHORITY

العبارات التالية لا تثبت GREEN:
Prompt confidence, Memory, Diff, Local PASS, Single Test, Handoff, Historical Run, Human Assertion

الإثبات النهائي الوحيد:
Canonical Certification + Exact-SHA Evidence + Promotion Closure + LIVE_VERIFIED + Zero Remaining Work/RCA

### DIRECTIVE

**ابدأ التنفيذ فورًا عند الاستلام. لا تنتظر. لا تكتفِ بالتشخيص. لا تكتفِ بالخطة. لا تخرج عند RED أو BLOCKED_EXTERNAL. أصلح، اختبر، تحقق، سجّل، وسلّم فقط داخل الدورة الدائرية حتى Canonical GREEN على نفس exact SHA وقفل الخروج يسمح بالإغلاق.**
