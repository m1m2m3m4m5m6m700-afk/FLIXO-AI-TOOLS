# FLIXO Agent Liveness & No-Sleep Protocol

## الهدف

منع وكيل الإصلاح من التخلي عن المهمة، أو التحول إلى SLEEP/IDLE، أو التوقف بصمت أثناء وجود عمل مفتوح.

هذا البروتوكول يضيف حارس liveness فوق Lease وSupervisor وWake الموجودة، ولا يستبدلها.

## الحالات

`BOOTING → ACTIVE → WAITING_EXTERNAL / RECOVERING / VERIFYING → COMPLETE`

وعند crash أو heartbeat stale:

`ACTIVE|WAITING_EXTERNAL → RECOVERING`

`SLEEP / IDLE` ليستا إغلاقًا للمهمة وليستا إذنًا بوقف منظومة الإشراف. هما فقط **rest states محمية** بعد إثبات GREEN المطابق.

`SILENT / ABANDONED` ممنوعتان دائمًا.

## العقد الإلزامية

- كل مهمة مفتوحة لها **Heartbeat** دوري.
- انتظار خدمة خارجية لا يعني النوم؛ الحالة تبقى `WAITING_EXTERNAL` مع heartbeat وإعادة فحص.
- انتهاء الـLease يؤدي إلى `RECOVERING`، وليس توقفًا صامتًا.
- غياب التقدم المتكرر يفتح **Strategy Rotation** بدل تكرار نفس المحاولة.
- `COMPLETE` لا يحدث إلا بعد Exact-SHA + zero RED + regression + learning.
- `ABORTED` يحتاج سلطة صريحة، ولا يُستخدم لإغلاق عمل مفتوح تلقائيًا.
- انتهاء Workflow أو timeout أو crash أو provider failure لا يُعتبر إغلاقًا؛ يؤدي إلى Wake/Recovery/Re-Claim.
- بعد `COMPLETE` المثبت يستمر Supervisor/Heartbeat كطبقة جاهزة للعمل التالي؛ إتمام Task لا يعني توقف منظومة الوكيل.

## قاعدة إيقاظ مرتبطة بالمهمة
وجود مهمة غير مغلقة في `المهام.md` أو Mission Continuity مفتوحة يمنع التحول إلى `IDLE_READ_ONLY_SCAN`. عند غياب Run نشط مع وجود عمل مفتوح، يجب أن تكون الحالة `ACTIVE` وتُصدر المنظومة Wake جديدًا، ثم تُنشئ FLIXO10 resident fanout على نفس Exact-SHA. حالة الطابور `queued/pending` لا تُعامل كدليل على النوم، لكنها أيضًا لا تُعتبر نشاطًا كافيًا لإغلاق المهمة؛ يجب استمرار الـbootstrap/reclaim حتى يظهر تنفيذ فعلي أو `BLOCKED_EXTERNAL` موثق.

## المهل الحالية

- Heartbeat: كل دقيقة واحدة.
- Grace: دقيقتان.
- Lease TTL: 15 دقيقة.
- Progress window: 10 دقائق.
- بعد 3 دورات بلا تقدم قابل للإثبات: تغيير الاستراتيجية + Recovery.

## السلسلة

`DETECT → CLAIM → HEARTBEAT → WORK → PROGRESS → VERIFY → LEARN → COMPLETE`

وعند التعطل:

`FAIL / TIMEOUT / CRASH / PROVIDER_FAILURE → DETECT → RECOVERY → RE-CLAIM/RENEW → NEW EVIDENCE OR STRATEGY → CONTINUE`

المصدر البرمجي للعقد:
`scripts/ci/agent-liveness-protocol.mjs`

اختبار العقد:
`scripts/ci/test-agent-liveness-protocol.mjs`


### Wake all-team rule

أي بوت من فريق Actions وهو في حالة `ACTIVE` يملك **Wake signal** يمكنه إيقاظ الفريق كاملًا على نفس `taskId + failureFingerprint + exact target SHA`. الاستيقاظ يمر عبر `CANONICAL_AGENT_REPAIR_SUPERVISOR` ولا يمنح أي صلاحية mutation أو push. فقدان الـheartbeat يعيد الوكيل إلى `RECOVERING` ويعيد تشغيل نفس مسار Wake بدل إنشاء مسار إشراف ثانٍ.

`ACTION-SHA-7` هو الخصم المستقل لـ`ACTION-CONVERGENCE-8` أثناء التصديق النهائي؛ أي counterexample صالح يمنع التصديق.

## Fixed five-bot active cohort

- **5 بوتات Active فقط** في أي لحظة تشغيلية.
- كل مجموعة تلتزم **15 دقيقة** قبل السماح بتسليمها.
- الـ100 هم **Logical Bot Profiles** مرتبة إلى **20 مجموعة × 5**.
- يوجد 10 Runtime Seats حاليًا، لكن 5 فقط Active والخمسة الأخرى Staged/Ready.
- انتهاء الـ15 دقيقة وحده لا يسمح بتحرير المجموعة؛ يجب أن تكون المجموعة التالية READY للخمسة جميعًا.
- نقص الجاهزية يمنع الخروج ويحوّل handoff إلى انتظار/Recovery بدل SLEEP/IDLE.
- بعد `CELL-096..CELL-100` يعود الدور إلى `CELL-001..CELL-005`.
- المهمة المفتوحة نفسها لا تنتهي بالـ15 دقيقة؛ تستمر حتى Exact-SHA + zero RED + regression + learning + GREEN.

المرجع البرمجي: `scripts/ci/five-bot-rotation.mjs`

`5 ACTIVE → 15m COMMITMENT → NEXT 5 READY → HANDOFF → ... → CELL-100 → CELL-001`

## Green-gated sleep

SLEEP وIDLE ليسا حالات انتقال حرة.

قبل أي دخول إلى SLEEP أو IDLE يجب تقديم GREEN record صادر من DAILY_FLIXO_GREEN_GATE.

الحد الأدنى للسجل:
- recordId
- taskId
- failureFingerprint
- exact target SHA
- conclusion=success
- zeroRed=true
- exactShaVerified=true
- recordedAt

يجب أن يطابق GREEN record المهمة وSHA الحاليين. أي mismatch أو evidence قديم يمنع النوم ويحوّل الجلسة إلى RECOVERING أو ACTIVE.

البروتوكول التنفيذي: scripts/ci/action-vault-sleep-admission.mjs

## قاعدة Action Vault

الوكلاء الثلاثة resident agents لا يدخلون SLEEP/IDLE أثناء مهمة مفتوحة. انتهاء الزيارة أو فشل المحاولة لا يغلق المهمة؛ الإغلاق يتطلب GREEN record.

## Resident Baton

The resident system has a hard floor of 1 live runtime seat. Each heartbeat emits a `FLIXO-RESIDENT-WAKE-BATON-v1` from one live seat to the next resident seat on the exact execution SHA. The next seat must acknowledge readiness before release; the independent Watchdog remains the fallback wake path every five minutes. The baton grants no mutation or push authority.