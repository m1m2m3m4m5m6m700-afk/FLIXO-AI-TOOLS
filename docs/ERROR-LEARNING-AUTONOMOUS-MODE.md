# FLIXO Autonomous Error-Learning Mode

## الهدف
تحويل كل فشل في الـcanonical CI إلى حدث قابل للتشخيص والتعلم، مع فصل **التعلم الإجباري** عن **الإصلاح التلقائي**.

## الدورة التشغيلية

```text
CI failure
  ↓
Capture logs
  ↓
Normalize + fingerprint
  ↓
Root-cause classification
  ↓
Lookup error memory
  ↓
Bounded repair proposal
  ↓
Risk/confidence gate
  ↓
Isolated repair
  ↓
Reproduction + typecheck + static + build
  ↓
Verified repair OR rollback
  ↓
Persist learning outcome
  ↓
Future recurrence uses the learned case/playbook
```

## قواعد الأمان
- كل فشل يتم تسجيل نتيجة تعلم له، حتى إذا لم يوجد إصلاح آمن.
- لا يعتبر وجود `git diff` نجاحًا.
- لا تعتبر نتيجة `proposal-only` أو `rolled-back` إصلاحًا ناجحًا.
- الإصلاح لا يصبح مرشح PR إلا بعد `verified-repair` وإعادة الاختبارات المطلوبة.
- الإصلاحات التلقائية تبقى محكومة بسياسة المسارات والحدود الحالية.
- الذاكرة لا تمنح صلاحيات ولا تتجاوز Security/Registry.
- الإصلاحات غير الآمنة أو غير المؤكدة تبقى غير مطبقة، مع حفظ نتيجة المحاولة.
- لا يتم الدفع المباشر إلى `main` بواسطة Auto Repair Bot.

## الحالة
- [x] التقاط سجل الفشل.
- [x] fingerprint مستقل عن رقم التشغيل وSHA.
- [x] تصنيف RCA.
- [x] bounded repair engine.
- [x] confidence/risk gate.
- [x] reproduction قبل/بعد الإصلاح.
- [x] regression verification.
- [x] rollback عند فشل التحقق.
- [x] حفظ playbooks ونتائج المحاولات في Error Memory.
- [x] تسجيل learning outcome حتى عند عدم وجود إصلاح ناجح.
- [x] رفض اعتبار `diff` وحده دليل نجاح.
- [x] حفظ الذاكرة مع الإصلاح الموثق أو عبر PR تعلم مستقل عند عدم وجود إصلاح.
- [x] أدلة التنفيذ ونتائج التعلم تُرفع كـartifacts.

## معيار النجاح
`CI failure → diagnosis → learning record` يجب أن ينجح دائمًا ضمن حدود التشغيل، بينما `CI failure → automatic repair` لا ينجح إلا عند تحقق جميع بوابات الإصلاح والتحقق.
