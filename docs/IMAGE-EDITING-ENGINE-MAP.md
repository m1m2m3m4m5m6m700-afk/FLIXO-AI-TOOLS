# FLIXO Professional Image Editing Engine Map

## الهدف
استبدال فكرة 1000 أداة مستقلة بمجموعة صغيرة من الأدوات الرئيسية الواضحة والقابلة للاكتشاف، بحيث يحمل كل Engine اسمًا مفهومًا للمستخدم ومحركات بحث الويب، بينما يضم داخليًا مجموعة كبيرة من القدرات التنفيذية.

## القاعدة المعمارية

```text
SEO / User-facing Tool Name
        ↓
Tool Page + Complete Description
        ↓
ToolDefinition
        ↓
Capabilities
        ↓
Execution Engine
        ↓
Verifier
```

لا يعني عدد الأدوات الرئيسية عدد القدرات. الهدف هو نحو 40 Engine رئيسيًا يمكنها تغطية مئات القدرات، مع قابلية التوسع إلى 1000+ capability دون تضخيم Agent Core.

## قواعد التسمية
- الاسم واضح ويصف النتيجة التي يبحث عنها المستخدم.
- الاسم لا يكون داخليًا أو غامضًا مثل `EnhancementEngineV2`.
- وصف الأداة يذكر جميع القدرات المدعومة فعليًا.
- كل قدرة مذكورة في الوصف يجب أن تكون مرتبطة بعقد Registry قابل للتحقق.
- لا نضيف قدرة إلى الوصف لأغراض SEO إذا لم تكن قابلة للتنفيذ فعليًا.
- الصفحة العامة للأداة مستقلة وقابلة للفهرسة عندما تكون الأداة جاهزة للإنتاج.
- الاسم الإنجليزي canonical، مع أسماء/وصف مترجمين للغات FLIXO.

## خريطة الـ40 Engine

### 01 — AI Photo Enhancer
تحسين جودة الصور بالذكاء الاصطناعي: AI Denoise، AI Sharpen، Detail Recovery، Texture Recovery، Low-Light Enhancement، JPEG Artifact Removal، Quality Analysis، Face Enhancement، Super Resolution عند الحاجة.

### 02 — AI Image Upscaler
زيادة دقة الصور مع Super Resolution، استعادة التفاصيل، تحسين الحواف، تكبير الوجوه، معالجة الصور الصغيرة والمنخفضة الدقة، والحفاظ على التفاصيل أثناء التكبير.

### 03 — AI Photo Retouching
التنقيح الاحترافي: Healing، Clone، إزالة العيوب، Skin Smoothing، Texture Recovery، Wrinkle Reduction، Dodge & Burn، Frequency Separation، إزالة البقع والعيوب.

### 04 — AI Portrait Editor
تحرير الصور الشخصية: Face Detection، Skin Tone، Eye Enhancement، Teeth Enhancement، Hair Enhancement، Portrait Relighting، Background Blur، تحسين ملامح الوجه والإضاءة.

### 05 — AI Face Editor
تحليل الوجه وتحديد معالمه، تحسين العينين والأسنان والبشرة، تصحيح العيوب، تحسين الإضاءة، ومعالجة تفاصيل الوجه مع الحفاظ على الهوية البصرية.

### 06 — AI Background Remover
إزالة الخلفية: Subject Segmentation، Hair-Aware Masking، Edge Refinement، Transparent Background، Multi-Subject Isolation، ومعالجة الحواف المعقدة.

### 07 — AI Background Editor
تغيير وتمويه وتوسيع الخلفية، Background Replacement، Background Extension، Background Relighting، Blur، Color Matching، ودمج الموضوع مع الخلفية الجديدة.

### 08 — AI Object Remover
إزالة الأشخاص والكائنات والعناصر غير المرغوبة، Content-Aware Reconstruction، تنظيف المناطق المحيطة، واستعادة الخلفية بعد الإزالة.

### 09 — AI Object Editor
تحديد الكائنات ونقلها وتغيير حجمها وإعادة تلوينها وإضاءتها واستبدالها مع الحفاظ على المنظور والظلال.

### 10 — AI Generative Fill
Generative Fill، Generative Expand، إضافة عناصر، إزالة عناصر، استبدال مناطق، توسيع حدود الصورة، وإنشاء محتوى متوافق مع الإضاءة والمنظور.

### 11 — AI Photo Colorizer
تلوين الصور بالأبيض والأسود، Color Inference، Skin Tone Estimation، الحفاظ على التفاصيل، والتحكم في قوة الألوان والنتيجة النهائية.

### 12 — AI Color Correction
تصحيح White Balance، Tint، Color Cast، Exposure/Color Balance، Skin Tone Correction، Selective Color، وColor Matching.

### 13 — AI Photo Color Grading
Color Grading، LUT، Film Look، Cinematic Look، HSL، Curves، Selective Color، Tonal Color، Color Harmony، وحفظ Presets.

### 14 — RAW Photo Editor
RAW Demosaic، Exposure، Highlights/Shadows، White Balance، Camera Profiles، Lens Profiles، Chromatic Aberration، RAW Noise، Metadata، وRAW Export.

### 15 — Photo Compositing
تركيب الصور: Layers، Groups، Blend Modes، Layer Masks، Adjustment Layers، Smart Objects، Multi-Image Blend، Shadows، Reflections، Perspective Compositing.

### 16 — Photo Masking & Selection
AI Subject Mask، Person Mask، Face Mask، Hair Mask، Sky Mask، Object Mask، Color Range، Luminosity Mask، Brush Selection، Refine Edge، Feather، Expand/Contract.

### 17 — Photo Geometry & Perspective
Crop، Resize، Rotate، Flip، Perspective Correction، Warp، Lens Distortion، Content-Aware Resize، Straightening، وتصحيح التشوهات الهندسية.

### 18 — AI Photo Relighting
تحليل مصادر الضوء وإعادة الإضاءة، Subject Relighting، Background Relighting، Directional Light، Shadow Control، Highlight Control، وLight Matching.

### 19 — AI Sky Replacement
Sky Detection، Sky Replacement، Sky Relighting، Horizon Refinement، Reflection Matching، Color Matching، ودمج السماء مع الإضاءة الأصلية.

### 20 — AI Image Cleanup
إزالة الغبار والخدوش والبقع والعيوب الصغيرة، تنظيف المستشعر، إزالة العناصر الصغيرة، Artifact Cleanup، وPixel Cleanup.

### 21 — AI Noise & Deblur
AI Noise Reduction، Color Noise، Luminance Noise، Motion Deblur، Defocus Deblur، Grain Reduction، Detail Recovery، ومعالجة الصور منخفضة الإضاءة.

### 22 — HDR Photo Studio
HDR Merge، Exposure Bracketing Merge، Tone Mapping، Dynamic Range Recovery، Ghost Reduction، Local Contrast، وHDR Export.

### 23 — Panorama Maker
Panorama Stitching، Alignment، Projection، Seam Blending، Exposure Matching، Ghost Handling، Crop، وPanorama Export.

### 24 — Focus Stacking Studio
Focus Alignment، Focus Stack، Depth-of-Field Merge، Ghost/Edge Handling، Detail Preservation، وStack Quality Verification.

### 25 — AI Image Restoration
Old Photo Restoration، Scratch Removal، Tear/Damage Repair، Dust Removal، Faded Color Restoration، Face Restoration، Detail Recovery، ومعالجة الصور التاريخية.

### 26 — Product Photo Studio
Product Cutout، Background Removal، Shadow Generation، Reflection، Lighting Correction، Color Variant، Product Cleanup، Batch Product Processing.

### 27 — Real Estate Photo Studio
Interior/Exterior Enhancement، HDR، Window/Highlight Recovery، Vertical Correction، Sky Enhancement، Color Correction، Noise Reduction، وBatch Processing.

### 28 — Landscape Photo Studio
Landscape HDR، Sky Enhancement، Color Grading، Local Contrast، Dehaze، Detail Enhancement، Panorama، Focus Stack، وNatural Color Correction.

### 29 — Astro Photo Studio
Astro Noise Reduction، Star Enhancement، Stacking، Sky Masking، Color Balance، Gradient Removal، Detail Recovery، وAstro Export.

### 30 — Creative Photo Effects
Film Effects، Black & White، Duotone، Vignette، Light Leaks، Bokeh، Creative Blur، Glow، Grain، Stylized Looks، وEffect Presets.

### 31 — Photo Collage & Layout
Collage، Grid Layout، Templates، Canvas، Alignment، Spacing، Borders، Backgrounds، Text Placement، Multi-Photo Composition، وExport.

### 32 — Photo Batch Editor
Batch Resize، Batch Crop، Batch Color، Batch Rename، Batch Presets، Batch Watermark، Batch Metadata، Batch Conversion، Batch Compression، وWorkflow Execution.

### 33 — Image Converter
JPEG، PNG، WebP، AVIF، TIFF، BMP، HEIF/HEIC عند دعم البيئة، Format Conversion، Alpha Handling، Metadata Preservation، وBatch Conversion.

### 34 — Image Compressor
Lossy/Lossless Compression، Quality Control، Target File Size، Metadata Optimization، JPEG/WebP/AVIF Optimization، Batch Compression، وCompression Verification.

### 35 — Photo Metadata Studio
EXIF، IPTC، XMP، Camera Metadata، Copyright، Creator، Keywords، GPS Handling، Metadata Cleanup، Metadata Preservation، وBatch Metadata Editing.

### 36 — Color Management & Print Studio
ICC Profiles، Working Color Space، Soft Proofing، Print Size، DPI، Print Preflight، CMYK/RGB preparation، Gamut Awareness، وProfessional Export.

### 37 — Photo Automation Studio
Presets، Workflow Templates، Conditional Steps، Batch Pipelines، Parameter Reuse، Queueing، Retry Policies، وExecution Logs.

### 38 — AI Photo Analysis
Image Quality Analysis، Object Detection، Face Detection، Scene Detection، Blur Detection، Exposure Analysis، Color Analysis، Resolution Analysis، وEdit Recommendations.

### 39 — Photo Export & Delivery
Web Export، Social Export، Print Export، JPEG/PNG/WebP/AVIF/TIFF/PSD where supported، Quality Profiles، Dimensions، Naming، Metadata Policy، وExport Validation.

### 40 — Photo Quality Inspector
Pixel Validation، Resolution Validation، Color/ICC Validation، Artifact Detection، Transparency Check، File Integrity، Before/After Comparison، Visual Regression، وFinal Quality Gate.

## الوصف الكامل لكل أداة
كل ToolDefinition يجب أن يحتوي على:

```ts
{
  id,
  name,
  description,
  category,
  capabilities,
  inputSchema,
  outputSchema,
  executable,
  ready,
  verifiable,
  requirements,
  recovery
}
```

`description` ليس وصفًا تسويقيًا قصيرًا فقط؛ بل وصف تشغيلي كامل يشرح نطاق الأداة وقدراتها الرئيسية. ويمكن توليد محتوى صفحة الأداة وملخصات الـSEO منه، مع منع اختلاف الوصف عن التنفيذ الحقيقي.

## اكتشاف الأدوات بواسطة Agent وSearch

```text
User Query / Search Intent
        ↓
Tool Page / Canonical Name
        ↓
Tool Definition
        ↓
Capability Matching
        ↓
Parameter Extraction
        ↓
Plan
        ↓
Execution
        ↓
Verification
```

### قواعد SEO/Discovery
- صفحة مستقلة لكل Engine جاهز.
- URL ثابت وواضح مثل `/ar/ai-photo-enhancer`.
- Title وH1 يصفان الوظيفة الأساسية بوضوح.
- وصف الصفحة يذكر القدرات الفعلية كاملة دون حشو كلمات مفتاحية.
- أمثلة استخدام حقيقية.
- صيغ الإدخال والإخراج المدعومة.
- FAQ فقط عندما يكون مفيدًا ومطابقًا للمحتوى.
- Structured Data حسب نوع الصفحة وبما يتوافق مع المحتوى الفعلي.
- Canonical URL مطلق وثابت.
- Sitemap يتضمن الصفحات القابلة للفهرسة.
- عدم إنشاء صفحات آلية عديمة القيمة لكل capability منفردة.
- عدم إنشاء doorway pages أو صفحات متكررة لمجرد استهداف كلمات بحث.
- كل لغة لها صفحة مترجمة حقيقية وليست نسخة آلية فارغة.

## قاعدة الدمج
إذا كانت عدة قدرات تشترك في نفس محرك التنفيذ أو نفس رحلة المستخدم، تظل داخل Engine واحد. وإذا كانت القدرة لها نية بحثية مستقلة وقيمة استخدام واضحة ومحرك تنفيذ مستقل، يمكن ترقيتها لاحقًا إلى Engine مستقل.

## سياسة النمو
- البداية: 40 Engine رئيسيًا.
- التوسع الأول: 40 → 60 عند وجود حاجة حقيقية.
- القدرات الداخلية يمكن أن تتجاوز 180 ثم 500 ثم 1000+ دون تغيير Agent Core.
- لا تتم إضافة Engine جديد لمجرد زيادة العدد.
- كل Engine جديد يمر عبر Dynamic Tool Registry وAuto-Discovery Contract Tests.

## بوابة قبول Engine جديد
- [ ] اسم واضح للمستخدم.
- [ ] Intent واضح وقابل للاكتشاف.
- [ ] وصف كامل مطابق للتنفيذ.
- [ ] Capabilities محددة.
- [ ] Input/Output schemas.
- [ ] executable/ready/verifiable صحيحة.
- [ ] صفحة قابلة للفهرسة عند الجاهزية.
- [ ] اختبار Planner discovery.
- [ ] اختبار Executor.
- [ ] اختبار Verifier.
- [ ] اختبار failure/recovery.
- [ ] عدم الحاجة إلى تعديل Agent Core لإضافة الـEngine.
