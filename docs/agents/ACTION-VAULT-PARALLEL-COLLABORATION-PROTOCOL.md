# ACTION VAULT — PARALLEL COLLABORATION PROTOCOL v1

## الهدف
يعمل ACTION-REPAIR وACTION-REPAIR-2 وACTION-HISTORIAN-3 بالتوازي في التحليل والتعلم، وليس بالتوازي في تعديل المصدر.

## القاعدة العليا
ALL THREE THINK IN PARALLEL → ALL THREE EXCHANGE → ONE ADMITTED MUTATION SEAT MUTATES → ALL THREE VERIFY → GREEN → SHARED LEARNING

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
6. Single-Seat Mutation Protocol: وكيل واحد فقط يكتب المصدر في اللحظة نفسها؛ المقعد المختار قد يكون VAULT-1 أو VAULT-2، وبعد 20 حالة غير محلولة يكون VAULT-3.
7. Supervisor-20 Protocol: عند 20 تكرارًا لنفس fingerprint، يتوقف VAULT-1 وVAULT-2 عن mutation لذلك fingerprint، ويتولى VAULT-3 مراجعة الكتالوج واختيار/تنفيذ الحل.
8. Green-Learning Protocol: لا promotion للذاكرة المشتركة قبل Canonical GREEN.
9. No-Sleep Protocol: المهمة المفتوحة لا تدخل SLEEP أو IDLE.
10. Green-Sleep Admission Protocol: SLEEP لا يسمح به إلا مع GREEN record مطابق للـSHA.

## الفشل
غياب وكيل → WAKE → RECOVER → REJOIN.
فشل المحاولة → إعادة RCA/challenge؛ تكرار نفس fingerprint حتى 20 → SUPERVISOR_20 → ACTION-HISTORIAN-3.
غياب الدليل → BLOCKED وليس GREEN.
تغير SHA → INVALIDATE EXCHANGE → RE-READ → RE-ANALYZE.

## السلطة
Knowledge ≠ Mutation Authority ≠ Certification.
Canonical CI وحدها تثبت GREEN.


## Triad Governor Extension

The parallel collaboration contract is extended by `ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-v1`.

VAULT-1 and VAULT-2 have equal programming intelligence and may each prepare and apply a candidate source repair when they are the admitted mutation seat. VAULT-3 may prepare and apply a source repair only in `SUPERVISOR_20` after the same stable failure fingerprint reaches 20 unresolved occurrences.

Only one mutation seat may write source at a time. The other seats remain active for challenge, evidence, catalog review and learning.

Every RED is logged. Every catalog miss is logged. New advice is candidate-only until exact-SHA canonical GREEN promotes it into the Action Vault catalog.
