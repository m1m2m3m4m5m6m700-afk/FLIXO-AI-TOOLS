# ACTION VAULT — PARALLEL COLLABORATION PROTOCOL v1

## الهدف
يعمل ACTION-REPAIR وACTION-REPAIR-2 وACTION-HISTORIAN-3 بالتوازي في التحليل والتعلم، وليس بالتوازي في تعديل المصدر.

## القاعدة العليا
ALL THREE THINK IN PARALLEL → ALL THREE EXCHANGE → ONE OWNER MUTATES → ALL THREE VERIFY → GREEN → SHARED LEARNING

## المسارات
ACTION-REPAIR: RCA الحالي → خطة إصلاح محدودة → regression plan → تنفيذ فقط بعد اكتمال التبادل.
ACTION-REPAIR-2: RCA مستقل → hypothesis بديلة → falsification → اعتراض على خطة المالك.
ACTION-HISTORIAN-3: intake → fingerprint → historical search → provenance → تسجيل فرضيات ونتائج الزملاء.

## مراحل التعاون
PARALLEL_DISCOVERY → PARALLEL_ANALYSIS → CROSS_LEARNING → CHALLENGE → SYNTHESIS → OWNER_MUTATION → VERIFICATION → GREEN_LEARNING → CLOSED

## بوابة التبادل
لا يسمح للمالك بتعديل المصدر حتى:
ACTION-REPAIR contribution + ACTION-REPAIR-2 contribution + ACTION-HISTORIAN-3 contribution + exchange complete + peer learning receipts.

كل مساهمة مرتبطة بـ taskId + failureFingerprint + targetSha + runId.

## التعلم المتبادل
قبل الإصلاح: كل وكيل يسجل ملاحظته بصورة مستقلة، ثم يستلم مساهمتي الوكيلين الآخرين، ويسجل النظام receipt لقراءة المعرفة المتبادلة، ثم يفتح challenge قبل اختيار الاستراتيجية.

أثناء المهمة: المعرفة غير المثبتة مؤقتة داخل المهمة فقط. لا تتحول إلى معرفة موثوقة إلا بعد GREEN.

بعد GREEN: يسجل المؤرخ RED → hypotheses → challenge → mutation → regression → GREEN، ثم تُرقّى الدروس المشتركة إلى الذاكرة القابلة لإعادة الاستخدام.

## بروتوكولات التعاون الإلزامية
1. Exact-Context Protocol: نفس task/fingerprint/SHA/run.
2. Independent-RCA Protocol: فرضية مستقلة من ACTION-REPAIR-2.
3. Historian-Evidence Protocol: المصدر والدليل والتسلسل محفوظان.
4. Cross-Learning Protocol: لا mutation قبل قراءة مساهمات الزملاء.
5. Challenge Protocol: كل استراتيجية قابلة للطعن قبل التنفيذ.
6. Single-Owner Mutation Protocol: مالك واحد فقط يكتب المصدر.
7. Handoff Protocol: فشل المالك ينقل الملكية رسميًا إلى ACTION-REPAIR-2.
8. Green-Learning Protocol: لا promotion للذاكرة المشتركة قبل Canonical GREEN.
9. No-Sleep Protocol: المهمة المفتوحة لا تدخل SLEEP أو IDLE.
10. Green-Sleep Admission Protocol: SLEEP لا يسمح به إلا مع GREEN record مطابق للـSHA.

## الفشل
غياب وكيل → WAKE → RECOVER → REJOIN.
فشل المالك → ACTION-REPAIR → HANDOFF → ACTION-REPAIR-2.
غياب الدليل → BLOCKED وليس GREEN.
تغير SHA → INVALIDATE EXCHANGE → RE-READ → RE-ANALYZE.

## السلطة
Knowledge ≠ Mutation Authority ≠ Certification.
Canonical CI وحدها تثبت GREEN.
