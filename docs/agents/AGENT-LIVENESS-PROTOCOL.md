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

## المهل الحالية

- Heartbeat: كل 5 دقائق.
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
