# ACTION VAULT — TARGETED REPAIR PROTOCOL v1

## الهدف
أي RED ناتج عن Action Vault أو أي إصلاح داخل مساره يبدأ بعزل الجزء المتضرر، ثم إصلاحه، ثم اختبار الجزء المتضرر فقط كتحقق سريع.

## القاعدة
DIAGNOSE → ISOLATE IMPACTED SURFACE → THREE-BOT COLLABORATION → BOUNDED REPAIR → TARGETED REGRESSION → EXACT-SHA → CANONICAL GREEN

## لا نعيد الاختبار الكامل في الدورة السريعة
الاختبارات المستهدفة تعطي أسرع إشارة بعد الإصلاح. لا يجوز استخدامها لإعلان GREEN النهائي؛ Canonical CI يبقى سلطة الإثبات.

## التصنيف
- AGENT_CONTRACT: ACTION-VAULT-AGENT-GRADE.json أو ملفات تعريف الوكلاء → test:action-vault-agents.
- COLLABORATION: ACTION-THREE-BOT-INTELLIGENCE.json أو collaboration/chat protocol → test:action-vault-parallel.
- RESIDENCY_LIVENESS: ACTION-RESIDENCY-POLICY.json أو liveness protocol → test:agent-liveness.
- CI_CONTRACT: workflow files → validate:ci-contract.
- ACTION_BOT_MEMORY: action-repair-bots/*.json → test:action-vault-agents.
- DOCUMENTATION_ONLY: docs-only changes → contract/schema checks only.

## قاعدة نطاق الإصلاح
إذا كان الخطأ محصورًا في ملف أو مجموعة ملفات، لا تُفتح تغييرات خارج النطاق إلا إذا أثبت RCA علاقة سببية.

## قاعدة التحقق
1. احفظ exact target SHA.
2. احسب affected paths من مقارنة SHA السابق والهدف.
3. شغّل targeted regression للعائلة المتأثرة.
4. إذا فشل الاختبار المستهدف، لا تبدأ full CI؛ عد إلى RCA وتغيير الاستراتيجية.
5. بعد نجاح targeted regression، أعد التحقق Exact-SHA.
6. GREEN النهائي يتطلب Canonical CI.

## توفير الوقت
يمكن تشغيل عدة targeted tests بالتوازي عندما تكون العائلات مستقلة، لكن لا يجوز تنفيذ source mutation بالتوازي.

## التصعيد
إذا لم يمكن عزل الضرر، الحالة BLOCKED/RCA_REQUIRED وليست GREEN.
