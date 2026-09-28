# FLIXO — هندسة الوصول إلى MVP وشهادة الإثبات

## 1. الهدف القابل للإثبات
الوصول إلى SHA واحد على فرع `execution` يحقق في آن واحد:
- Agent Guided Workflow وManual Standalone Workflow.
- تنفيذ الملفات داخل المتصفح فقط.
- عدم إرسال bytes الخاصة بملفات المستخدم إلى الشبكة.
- Agent عام واحد `FLIXO_AGENT` مع متخصصين داخليين غير قابلين للاستدعاء مباشرة.
- تخطيط حتمي للطلبات القياسية مع fallback يدوي عند الغموض أو فشل التنفيذ.
- اختيار نماذج محكوم بـ provenance/license/policy/evaluation، مع fail-closed.
- عدم اعتماد نموذج أو مزود واحد كنقطة فشل وحيدة.
- Executor + Verifier مستقلان عن النموذج.
- Red-Team وCI على نفس SHA، ثم شهادة Exact-SHA.

## 2. بوابات التنفيذ
### G0 — Baseline
ثبت SHA الحالي، حالة الفرع، علاقة `execution` مع `main`، وحالة PR. لا شهادة على أدلة SHA قديم.

### G1 — Public Agent Boundary
المستخدم يتعامل مع `FLIXO_AGENT` فقط. يمنع العقد العام أي `specialist` أو استدعاء مباشر لوكيل داخلي. يجب أن يفشل الاختبار عند محاولة تمرير متخصص.

### G2 — Model Admission
كل نموذج مستخدم فعلياً يجب أن يكون في manifest مع:
provenance + exact artifact SHA-256 + license text + policy/AUP + commercial/redistribution terms + lifecycle + human review.
الحالات UNKNOWN/REVIEW_REQUIRED/QUARANTINED/BLOCKED لا تدخل الإنتاج.

### G3 — Model/Provider Failover
مسار الاستدعاء لا يختار النموذج من env مباشرة إذا كان غير مسجل. يبني قائمة candidates من الـ canonical model fabric، يجرب المرشحين المقبولين ضمن budget ثابت، ويسقط إلى deterministic local planner عند فشل الجميع. فشل نموذج أو سحب ترخيصه لا يوقف مسار الأدوات المحلية.

### G4 — Canonical Tool Execution
كل خطة تمر عبر Tool Registry واحد، ثم Executor، ثم Output Contract وVerifier. لا يسمح للنموذج بتجاوز registry أو تنفيذ تعليمات خارج العقد.

### G5 — Privacy/Browser Boundary
اختبارات تثبت أن bytes لا تعبر الشبكة، وأن executionLocation هو BROWSER_ONLY، وأن المسار اليدوي متاح لكل capability الجاهزة.

### G6 — Functional Proof
تشغيل مجموعة intents الإنجليزية والعربية، المركبة، والغموض، واختبارات planner/gateway/executor/verifier. أي failure أو skipped/cancelled required check يمنع GREEN.

### G7 — Red-Team
اختبار: direct specialist injection، model unregistered، bad hash، license quarantine، provider outage، malformed plan، tool not executable، verifier failure، network-file-byte violation، stale SHA.

### G8 — Exact-SHA CI
انتظار جميع required checks على نفس SHA النهائي. لا يعتمد النجاح على branch آخر أو SHA سابق.

### G9 — Browser Acceptance
تشغيل التطبيق فعلياً واختبار المسارين، رفع ملف، طلب تعديل طبيعي، تنفيذ/تحقق النتيجة، ثم المسار اليدوي، مع التقاط evidence references.

### G10 — Certification
تُصدر الشهادة فقط إذا:
1. كل البوابات G0-G9 PASS.
2. لا توجد required checks معلقة/ملغاة/متخطاة بدلاً من نجاحها.
3. كل الأدلة تشير إلى SHA النهائي نفسه.
4. `main` لم يُكتب مباشرة.
5. PR ما زال خاضعاً للمراجعة البشرية عند وجود workflow/security policy changes.
6. لا توجد claims قانونية أوسع من الأدلة.

## 3. حالات الفشل
- نموذج غير مسجل أو evidence ناقص → BLOCKED.
- سحب/تغيير ترخيص → QUARANTINED، ثم fallback إلى candidate مستقل أو local deterministic path.
- مزود متعطل → next admitted candidate، ثم local fallback.
- plan غير متوافق → fail-closed.
- verifier يفشل → لا يعلن نجاح العملية.
- SHA تغيّر أثناء التشغيل → STALE؛ لا تُنسب النتيجة إلى SHA القديم.
- required check skipped/cancelled → NOT CERTIFIED.

## 4. ترتيب التنفيذ
1. إصلاح public boundary وtests.
2. ربط model-fabric فعلياً بقرار runtime.
3. بناء provider/model failover deterministic.
4. توسيع red-team tests.
5. تشغيل core + MVP proof.
6. إصلاح كل failure على execution فقط.
7. تشغيل CI على SHA نهائي.
8. browser acceptance على نفس release candidate.
9. تجميع evidence manifest.
10. إصدار شهادة Exact-SHA أو شهادة عدم اجتياز مع قائمة gaps.

## 5. معيار النتيجة للمستخدم
نجاح MVP يعني أن المستخدم يستطيع وصف التعديل، يحصل على خطة مفهومة، ينفذها محلياً داخل المتصفح، يرى نتيجة تم التحقق منها، ويمكنه تجاوز الوكيل واستخدام الأدوات يدوياً. الاعتماد على نموذج خارجي اختياري في التخطيط وليس شرطاً لتنفيذ الأدوات المحلية.

## 6. القاعدة القانونية
إخفاء الوكلاء الداخليين لا يلغي حقوق أو التزامات تراخيص النماذج. كل artifact/model مستخدم فعلياً يخضع لسجل الترخيص والسياسة الخاص به. الهدف الهندسي هو قابلية الاستبدال وتقليل نقطة الفشل، وليس التحايل على الترخيص.
