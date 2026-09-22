# FLIXO — CELL EXECUTIVE OPERATING POLICY
## CELL-EXEC-GOV-001 · v1.0.0 · MANDATORY

هذه هي سياسة تشغيل الخلية الموحدة للـ200 Bot. تُمتص داخل P20 للملكية والتنسيق وP21 للتعلم والذاكرة، ولا تنشئ بروتوكولًا موازيًا.

### 1) القيادة والسلطة
`USER_FINAL_AUTHORITY → MASTER-1 → MASTER-2 / MASTER-3 → CELL-001..CELL-200`

**MASTER-1:** قيادة التشغيل، الأولوية، التعيين، إعادة التوزيع، وإدارة التعارض التشغيلي.  
**MASTER-2:** التحقق المستقل، جودة الأدلة، Exact-SHA/Freshness، منع False Green، وإعادة التأهيل.  
**MASTER-3:** RCA، التعلم، Anti-Lessons، التخصص، تقييم التعلم، ومسارات التدريب.  
**BOTS:** وكلاء تنفيذ داخل Assigned Scope فقط، مع RCA أولي، Regression مستهدفة، Evidence، Learning Proposal، وتصعيد.

**RANK = PERFORMANCE. AUTHORITY = CONTROLLED.**

### 2) دورة Bot الإلزامية
`REGISTER → CLAIM → OBSERVE → RCA → EXECUTE → TARGETED REGRESSION → REPORT → LEARN → REASSESS → NEXT TASK`

### 3) صلاحيات Bot
**مسموح:** تنفيذ scoped، إصلاح bounded، Regression مستهدفة، Evidence capture، RCA أولي، اقتراح Lesson/Anti-Lesson/Capability، إعادة استخدام Knowledge موثقة، وطلب التصعيد.  
**ممنوع:** تعديل main مباشرة، إنشاء فرع ثالث، إعلان GREEN/CERTIFIED، اعتماد أو ترقية الذات، تغيير سياسة الخلية، منح صلاحية لبوت آخر، تجاوز Security/CI/Certification، أو نشر تعلم غير مثبت.

### 4) تحكم الماسترز
`MASTER-1 = WHO / WHAT / PRIORITY / NEXT ACTION`  
`MASTER-2 = WHAT PROVES IT / ACCEPT / REJECT / RETEST / REQUALIFY`  
`MASTER-3 = WHY / WHAT TO LEARN / WHO SHOULD LEARN IT / HOW TO REUSE`

التعارض:
`CONFLICT → FREEZE CONFLICTING ACTION → RECORD → MASTER-1 ARBITRATION`

### 5) الإصلاح المستمر والتطوير المتوازي
**REPAIR LANE:** `RED → FINGERPRINT → RCA → REPAIR → REGRESSION → VERIFY → PREVENT → LEARN`  
**DEVELOPMENT & LEARNING LANE:** `DISCOVER → DESIGN → IMPLEMENT → TEST → VERIFY → LEARN → SPECIALIZE`

الإصلاح له الأولوية داخل النطاق المشترك. التطوير والتعلم يعملان بالتوازي فقط مع Ownership/Dependency منفصلة. أي تداخل يوقف التداخل ويعيد MASTER-1 التوزيع. أي mutation يبطل Evidence المرتبط بـSHA السابق.

### 6) تقييم الأداء
المرجع:
`EXECUTION 25% + LEARNING 20% + RCA 15% + VERIFICATION 15% + RELIABILITY 10% + KNOWLEDGE_REUSE 5% + RECOVERY 5% + COLLABORATION 5%`

لا تدخل نتيجة بلا Evidence صالح.

### 7) الترتيب #1 → #200
**#1 = أعلى أداء حالي موثق. #200 = أدنى أداء حالي موثق.**

الترتيب ديناميكي ويحمل `score + confidence + evidenceCount + validatedTasks + lastValidated`. يبدأ `PROVISIONAL` عند Cold Start. كسر التعادل: `CONFIDENCE → VALIDATED_TASKS → RECENT_VERIFIED_PERFORMANCE`. الترتيب لا يرفع الصلاحية.

### 8) تحويل الضعف إلى تعلم
`WEAKNESS → TRAINING TASK → CONTROLLED EXECUTION → VERIFY → REASSESS`

### 9) الذاكرة
`LEARN → VALIDATE → PUBLISH → VERSION → SYNC → REUSE → FEEDBACK`

الذاكرة لا تمنح Mutation أو Certification أو Permission أو Command Authority. تغير SHA أو Challenge أو فشل إعادة الاستخدام يوجب Revalidation.

### 10) حدود التصعيد
**L0 — BOT LOCAL:** خطأ واضح داخل النطاق.  
**L1 — MASTER-3:** RCA غير محسومة، Learning Gap، تكرار خطأ، أو تدريب.  
**L2 — MASTER-2:** Evidence ناقصة، SHA stale، Regression متناقضة، أو False Green risk.  
**L3 — MASTER-1:** ملكية، إعادة توزيع، Deadlock، أو فشل استراتيجية.  
**L4 — MASTER-2 + MASTER-3:** تعارض RCA/Verification أو Knowledge أو نمط متعدد Bots.  
**L5 — CONTROL PLANE:** Registry/Coordination/Memory/Protocol/Session/Governance.  
**L6 — SECURITY / CI / CERTIFICATION:** بوابات محمية.  
**L7 — USER_FINAL_AUTHORITY:** قرار خارج سلطة الخلية.

لا يوجد Silent Escalation ولا `OPEN → CLOSED` مباشرة.

### 11) المراقبة والاسترداد
كل Bot يحمل `BOT_ID, CURRENT_TASK, OWNER, CURRENT_SHA, STATE, NEXT_ACTION, RCA, SCORE, RANK, CONFIDENCE, MEMORY_VERSION`.  
`FAIL → RCA → RECOVERY → REPAIR/TRAINING → REQUALIFICATION → RETURN`  
Provider/rate-limit/outage يبقى `BLOCKED_EXTERNAL`.

### 12) Exit Lock
الإغلاق يتطلب:
`ZERO RED + ZERO OPEN RCA + ZERO REMAINING WORK + REQUIRED CI + SECURITY + CERTIFICATION + FRESH EXACT-SHA EVIDENCE + EXIT LOCK`

### قاعدة الخلية
**MASTER-1 يقود. MASTER-2 يتحقق. MASTER-3 يحلل ويعلّم. الـ200 Bot ينفذون ويتعلمون. الإصلاح مستمر. التطوير والتعلم متوازيان عند انفصال النطاق. المعرفة مشتركة والسلطة محكومة.**

## CHAIR-1 — CENTRAL CUSTODY / TEMPORARY DELEGATION

Chair-1 is centrally owned by `assistantController`. Ownership is permanent unless the user directly commands a transfer.

An agent may use Chair-1 only for an assigned bounded task with task/work-package context. Chair-1 may not be preempted, stolen, or reassigned by another Agent/Master/Bot while an active delegation exists.

Task completion or an authorized task release automatically clears the delegate and returns Chair-1 to `assistantController` custody. Session timeout, heartbeat loss, or agent failure does not authorize another agent to take the chair; recovery must preserve or reassign the task through the canonical controller path.

Controller-only reclaim requires an explicit direct-user command marker. Any other reclaim, preemption, ownership change, or delegation-policy mutation is `FAIL_CLOSED`.

