# HISTORICAL ACTION AGENT ACTIVITY PROTOCOL

## الهدف

تجعل ملفات **Historical GitHub Actions Errors** مكان الخبرة الدائمة لوكلاء Action Vault.

المبدأ:

**CURRENT RED → PARALLEL AGENT WORK → TARGETED REPAIR → EXACT-SHA → CANONICAL GREEN → HISTORICAL AGENT ACTIVITY PROMOTION**

## مصدر الخبرة

المسار الدائم:

`docs/agents/historical-action-errors/`

ومسار نشاط الوكلاء:

`docs/agents/historical-action-errors/agent-activity/`

الفهرس المركزي:

`docs/agents/historical-action-errors/agent-activity/index.json`

كل نشاط مُرقّى بعد GREEN يرتبط إلزاميًا بـ:

- taskId
- failureFingerprint
- targetSha
- failedRunId
- agentId
- lane
- phase
- hypothesis/RCA
- challenge
- repair decision
- targeted regression
- exact-SHA evidence
- final solution
- lesson أو anti-lesson
- provenance

## قواعد الخبرة

1. النشاط أثناء RED **provisional** ولا يعتبر حقيقة.
2. لا تتحول الخبرة إلى معرفة دائمة إلا بعد إثبات:
   - Canonical GREEN
   - exact target SHA
   - targeted regression
   - provenance صالح.
3. كل وكيل يقرأ الخبرة التاريخية قبل بدء التحليل.
4. الخبرة السابقة تُستخدم لتوليد فرضيات واستبعاد تكرار الاستراتيجيات، ولا تمنح mutation أو certification authority.
5. أي استراتيجية فاشلة أو reverted تُسجل كـ anti-lesson وتصبح إشارة **DO_NOT_REPEAT** ضمن نفس العائلة السببية.
6. الخبرة لا تُنسخ إلى الوكلاء كذاكرة غير موثقة؛ يتم ربطها دائمًا بملف تاريخي، بصمة، SHA، ونتيجة موثقة.
7. عند ظهور فشل جديد مشابه، يراجع الوكلاء:
   - نفس fingerprint أولًا.
   - نفس error class ثانيًا.
   - نفس workflow/job ثالثًا.
   - ثم الخبرات التاريخية المرتبطة causal family.
8. لا يُستخدم التاريخ لإعلان GREEN. مصدر الإثبات الحالي فقط هو Canonical CI على exact SHA.

## بنية السجل

كل ملف نشاط في `agent-activity/` يمثل عائلة/بصمة أو جلسة مكتملة، ويحتفظ بخط تعلم الوكلاء:

```text
evidence
  ↓
independent RCA
  ↓
challenge
  ↓
repair decision
  ↓
targeted regression
  ↓
exact SHA
  ↓
canonical GREEN
  ↓
lesson / anti-lesson
  ↓
historical reuse
```

هذا يجعل التاريخ **ذاكرة تشغيلية تراكمية** وليست مجرد أرشيف أخطاء.
