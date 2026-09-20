# FLIXO Agent Liveness & No-Sleep Protocol

## الهدف

منع وكيل الإصلاح من التخلي عن المهمة، أو التحول إلى SLEEP/IDLE، أو التوقف بصمت أثناء وجود عمل مفتوح.

هذا البروتوكول يضيف حارس liveness فوق Lease وSupervisor وWake الموجودة، ولا يستبدلها.

## الحالات

`BOOTING → ACTIVE → WAITING_EXTERNAL / RECOVERING / VERIFYING → COMPLETE`

وعند crash أو heartbeat stale:

`ACTIVE|WAITING_EXTERNAL → RECOVERING`

ولا توجد حالة تشغيل مسموحة باسم:

`SLEEP / IDLE / SILENT / ABANDONED`

## العقد الإلزامية

- كل مهمة مفتوحة لها **Heartbeat** دوري.
- انتظار خدمة خارجية لا يعني النوم؛ الحالة تبقى `WAITING_EXTERNAL` مع heartbeat وإعادة فحص.
- انتهاء الـLease يؤدي إلى `RECOVERING`، وليس توقفًا صامتًا.
- غياب التقدم المتكرر يفتح **Strategy Rotation** بدل تكرار نفس المحاولة.
- `COMPLETE` لا يحدث إلا بعد Exact-SHA + zero RED + regression + learning.
- `ABORTED` يحتاج سلطة صريحة.
- فشل الوكيل أو انقطاعه يؤدي إلى Wake/Recovery، وليس إغلاق المهمة.

## المهل الحالية

- Heartbeat: كل 5 دقائق.
- Grace: دقيقتان.
- Lease TTL: 15 دقيقة.
- Progress window: 10 دقائق.
- بعد 3 دورات بلا تقدم قابل للإثبات: تغيير الاستراتيجية + Recovery.

## السلسلة

`DETECT → CLAIM → HEARTBEAT → WORK → PROGRESS → VERIFY → LEARN → COMPLETE`

وعند التعطل:

`FAIL → RECOVERY → RE-CLAIM/RENEW → NEW EVIDENCE OR STRATEGY → CONTINUE`

المصدر البرمجي للعقد:
`scripts/ci/agent-liveness-protocol.mjs`

اختبار العقد:
`scripts/ci/test-agent-liveness-protocol.mjs`
