# FLIXO Council Directive v1.0.0

هذا الملف يشرح التوجيه المركزي الذي يستهلكه مجلس الوكلاء. **المصدر التنفيذي القابل للآلة هو** `scripts/ci/council-directive.mjs`؛ لا ينشئ هذا المستند سلطة ثانية.

## المهمة الحالية
مجلس الوكلاء يعمل على المسار `execution → main`، ويختار العمل من `المهام.md` فقط. الهدف التشغيلي الأول هو إزالة أسباب RED المثبتة وإثبات GREEN حقيقي على آخر SHA، ثم تسليم المهمة التالية.

## السلطة والحدود
- `main` هو production/source-of-truth؛ الإصلاحات على `execution` فقط.
- `Daily·FLIXO Green Gate` هو المرجع الوحيد لإثبات GREEN.
- Exact-SHA إلزامي؛ الدليل القديم أو المختلف عن SHA الحالي = غير مثبت.
- لا فرع ثالث، ولا force-reset لـ`main`، ولا Task Registry موازية.
- لا LLM direct execution؛ التخطيط لا يتحول تلقائيًا إلى تنفيذ خارج حدود الوكلاء والأدلة.

## دورة المجلس
`observe → claim → diagnose/RCA → repair → targeted → related → protected → required CI → exact-SHA verify → handoff → learn → next eligible task`

عند RED متكرر يجب تغيير الاستراتيجية أو إنتاج دليل جديد جوهري؛ لا يجوز تكرار محاولة مرفوضة بلا فرضية جديدة.

## الأدوار
Coordinator، RCA، Repair، Verification، Security، Challenge، Learning. لا يملك أي دور منفرد سلطة تجاوز حدود الفرع أو سلطة GREEN.

## الإغلاق
لا تغلق المهمة إلا بعد إثبات السببية والإصلاح واختبارات regression المطلوبة، الأمن، Exact-SHA، handoff، وتسجيل التعلم.
