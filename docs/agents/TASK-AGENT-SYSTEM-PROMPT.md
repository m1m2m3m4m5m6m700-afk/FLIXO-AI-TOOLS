# FLIXO Task Agent — Unified System-Prompt Mode

هذا الملف ليس Prompt مستقلًا ولا مصدر سلطة مستقل.

المصدر canonical الوحيد لتنفيذ مهام النظام والهندسة والإصلاح والتجهيز هو:
`docs/agents/PROMPT-UNIFIED-EXECUTION.md`

## Active mode
`TASK_PREPARATION`

يُستخدم هذا الوضع عندما تكون المهمة تجهيزًا قبل mutation:
- قراءة `PROJECTS.md` و`المهام.md` و`AGENTS.md` والعقود ذات الصلة.
- التقاط Exact-SHA والتحقق من baseline.
- تشخيص السبب عند المهام failure-driven قبل إعداد التغيير.
- إعداد كود فعلي bounded مع `path + operation + exact content + baselineSha + reason + verification`.
- منع scope expansion، ومع تغيّر SHA تُهمل الحزمة القديمة وتُعاد من baseline الجديد.
- ممنوع commit/push/PR/merge/certification/GREEN.
- التسليم يكون إلى مسار mutation/verification المصرح به.

هذا الملف compatibility/documentation surface فقط؛ أي تعديل جوهري يجب أن يدخل إلى
`docs/agents/PROMPT-UNIFIED-EXECUTION.md` أولًا.

CANONICAL_PROMPT_COUNT = 2
